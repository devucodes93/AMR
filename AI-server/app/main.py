from __future__ import annotations

from datetime import timezone
from typing import Any

from fastapi import FastAPI

from . import db
from . import supabase_store
from .risk_engine import compute_increment, risk_level
from .schemas import AnalyzeResponse, AlertsResponse, AlertItem, IngestEventRequest, ZonesResponse, ZonePoint
from .gemini_client import analyze_events_report, GeminiError, predict_event, validate_region

app = FastAPI(title="AMR AI Server", version="1.0.0")


def _coalesce(*values):
    for value in values:
        if value is not None and value != "":
            return value
    return None


def _to_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _extract_geo_from_payload(payload: dict[str, Any]) -> tuple[str | None, str | None, float | None, float | None]:
    location_details = payload.get("locationDetails") or {}
    if not isinstance(location_details, dict):
        location_details = {}

    address = location_details.get("address") or {}
    if not isinstance(address, dict):
        address = {}

    pincode = _coalesce(
        payload.get("pincode"),
        address.get("postcode"),
    )
    district = _coalesce(
        payload.get("district"),
        address.get("state_district"),
        address.get("city_district"),
        address.get("county"),
    )
    latitude = _to_float(
        _coalesce(
            payload.get("latitude"),
            location_details.get("lat"),
            location_details.get("latitude"),
        )
    )
    longitude = _to_float(
        _coalesce(
            payload.get("longitude"),
            location_details.get("lon"),
            location_details.get("longitude"),
        )
    )

    return pincode, district, latitude, longitude


def _extract_location_label(payload: dict[str, Any]) -> str | None:
    location_details = payload.get("locationDetails") or {}
    if not isinstance(location_details, dict):
        location_details = {}

    address = location_details.get("address") or {}
    if not isinstance(address, dict):
        address = {}

    return _coalesce(
        payload.get("locationLabel"),
        location_details.get("display_name"),
        location_details.get("name"),
        address.get("neighbourhood"),
        address.get("suburb"),
        address.get("city"),
    )


def _extract_city_label(payload: dict[str, Any], district: str | None, location_label: str | None, pincode: str | None) -> str:
    if district:
      return district

    if location_label:
        parts = [part.strip() for part in location_label.split(",") if part.strip()]
        if len(parts) >= 2:
            return parts[1]
        if parts:
            return parts[0]

    return pincode or "unknown"


@app.on_event("startup")
def startup_event() -> None:
    db.init_db()


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "service": "amr-ai-server",
        "supabaseMirror": supabase_store.is_enabled(),
    }


@app.post("/analyze/event", response_model=AnalyzeResponse)
def analyze_event(body: IngestEventRequest) -> AnalyzeResponse:
    payload = body.payload.copy()
    payload["district"] = _coalesce(body.district, payload.get("district"))
    payload["pincode"] = _coalesce(body.pincode, payload.get("pincode"))
    payload["latitude"] = _coalesce(body.latitude, payload.get("latitude"))
    payload["longitude"] = _coalesce(body.longitude, payload.get("longitude"))

    extracted_pincode, extracted_district, extracted_latitude, extracted_longitude = (
        _extract_geo_from_payload(payload)
    )
    extracted_location_label = _extract_location_label(payload)

    final_pincode = _coalesce(body.pincode, extracted_pincode)
    final_district = _coalesce(body.district, extracted_district)
    final_latitude = _to_float(_coalesce(body.latitude, extracted_latitude))
    final_longitude = _to_float(_coalesce(body.longitude, extracted_longitude))
    final_location_label = _coalesce(
        payload.get("locationLabel"),
        extracted_location_label,
        final_district,
        final_pincode,
    )

    zone_key = final_pincode or "unknown"
    increment = compute_increment(
        body.event_type,
        body.quantity,
        body.intensity,
    )

    existing = db.get_zone(zone_key)
    previous_score = float(existing["score"]) if existing else 0.0
    previous_level = existing["risk_level"] if existing else "low"
    new_score = previous_score + increment
    new_level = risk_level(new_score)

    event_time = (
        (body.event_time.astimezone(timezone.utc).isoformat())
        if body.event_time
        else db.now_iso()
    )

    payload["district"] = final_district
    payload["pincode"] = final_pincode
    payload["latitude"] = final_latitude
    payload["longitude"] = final_longitude
    payload["locationLabel"] = final_location_label

    db.save_ingested_event(
        event_type=body.event_type,
        event_time=event_time,
        pincode=final_pincode,
        district=final_district,
        latitude=final_latitude,
        longitude=final_longitude,
        quantity=body.quantity,
        intensity=body.intensity,
        danger_increment=increment,
        payload=payload,
    )

    # Validate with Gemini whether this region should be treated as a red/high-risk zone
    validated = True
    try:
        validation = validate_region(final_pincode, final_district, new_score)
        # Expecting provider to return JSON with is_red_zone boolean; fall back to True on unknown
        validated = bool(validation.get("is_red_zone", True)) if isinstance(validation, dict) else True
    except GeminiError:
        # If validation fails, assume validated=True to avoid blocking ingest; you can change this policy
        validated = True

    if validated:
        db.upsert_zone(
            pincode=zone_key,
            district=final_district,
            latitude=final_latitude,
            longitude=final_longitude,
            location_label=final_location_label,
            score=new_score,
            risk_level=new_level,
        )

        supabase_store.save_anomaly(
            zone_key=zone_key,
            event_type=body.event_type,
            score=round(new_score, 2),
            risk_level=new_level,
            increment=round(increment, 3),
            district=final_district,
            pincode=final_pincode,
            latitude=final_latitude,
            longitude=final_longitude,
            payload=payload,
        )

        supabase_store.upsert_zone(
            zone_key=zone_key,
            district=final_district,
            pincode=final_pincode,
            latitude=final_latitude,
            longitude=final_longitude,
            location_label=final_location_label,
            score=round(new_score, 2),
            risk_level=new_level,
        )

    city_label = _extract_city_label(payload, final_district, final_location_label, final_pincode)
    zone_label = final_location_label or final_district or zone_key
    alert_label = (
        f"{city_label} · {final_location_label.split(',')[0].strip()}"
        if final_location_label and "," in final_location_label and final_location_label.split(",")[0].strip() != city_label
        else city_label
    )

    # Auto-create alerts for high risk transitions and major score spikes.
    if validated and previous_level != "high" and new_level == "high":
        title = f"High AMR risk in {alert_label}"
        message = (
            f"{alert_label} has moved to HIGH risk after {body.event_type} event ingestion. Please use caution, avoid unnecessary antibiotic use, and contact the local health desk for guidance."
        )
        db.create_alert(
            pincode=final_pincode,
            location_label=alert_label,
            title=title,
            message=message,
            severity="high",
            score=new_score,
        )
        supabase_store.create_alert(
            zone_key=zone_key,
            pincode=final_pincode,
            location_label=alert_label,
            title=title,
            message=message,
            severity="high",
            score=round(new_score, 2),
        )
    elif validated and increment >= 10:
        title = f"Danger spike detected in {alert_label}"
        message = (
            f"Rapid score increase (+{increment:.1f}) observed for {body.event_type} event in {alert_label}. Please move to a safer nearby area and follow local guidance."
        )
        db.create_alert(
            pincode=final_pincode,
            location_label=alert_label,
            title=title,
            message=message,
            severity="medium",
            score=new_score,
        )
        supabase_store.create_alert(
            zone_key=zone_key,
            pincode=final_pincode,
            location_label=alert_label,
            title=title,
            message=message,
            severity="medium",
            score=round(new_score, 2),
        )

    return AnalyzeResponse(
        accepted=True,
        zone_key=zone_key,
        score=round(new_score, 2),
        risk_level=new_level,
    )


@app.get("/alerts", response_model=AlertsResponse)
def get_alerts(limit: int = 50) -> AlertsResponse:
    rows = db.get_recent_alerts(limit=limit)
    alerts = [
        AlertItem(
            id=str(row["id"]),
            title=row["title"],
            locationLabel=row["location_label"],
            time=row["created_at"],
        )
        for row in rows
    ]
    return AlertsResponse(alerts=alerts, source="ai-server")


@app.get("/zones", response_model=ZonesResponse)
def get_zones(limit: int = 500) -> ZonesResponse:
    rows = db.get_zone_points(limit=limit)
    points = [
        ZonePoint(
            pincode=row["pincode"],
            latitude=row["latitude"],
            longitude=row["longitude"],
            locationLabel=row["location_label"],
            score=float(row["score"]),
            riskLevel=row["risk_level"],
        )
        for row in rows
    ]
    return ZonesResponse(points=points, source="ai-server")


@app.get("/analyze/report")
def analyze_report(limit: int = 100) -> dict:
    rows = db.get_recent_events(limit=limit)
    events = []
    for row in rows:
        events.append({
            "id": row["id"],
            "event_type": row["event_type"],
            "event_time": row["event_time"],
            "pincode": row["pincode"],
            "district": row["district"],
            "quantity": row["quantity"],
            "intensity": row["intensity"],
            "danger_increment": row["danger_increment"],
            "payload": row["payload_json"],
        })
    try:
        report = analyze_events_report(events)
    except GeminiError as e:
        return {"ok": False, "error": str(e)}
    return {"ok": True, "report": report}


@app.post("/predict")
def predict(body: IngestEventRequest) -> dict:
    # Build a compact event dict for prediction
    event = {
        "event_type": body.event_type,
        "event_time": (body.event_time.astimezone(timezone.utc).isoformat() if body.event_time else db.now_iso()),
        "pincode": body.pincode,
        "district": body.district,
        "quantity": body.quantity,
        "intensity": body.intensity,
        "payload": body.payload,
    }
    try:
        prediction = predict_event(event)
    except GeminiError as e:
        return {"ok": False, "error": str(e)}
    return {"ok": True, "prediction": prediction}

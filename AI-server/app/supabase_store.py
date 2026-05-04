from __future__ import annotations

import os
from typing import Any

from supabase import Client, create_client

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

ANOMALY_TABLE = os.getenv("AI_SUPABASE_ANOMALY_TABLE", "ai_anomalies")
ZONE_TABLE = os.getenv("AI_SUPABASE_ZONE_TABLE", "ai_zone_risk")
ALERT_TABLE = os.getenv("AI_SUPABASE_ALERT_TABLE", "ai_alerts")


def _build_client() -> Client | None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    try:
        return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    except Exception:
        return None


_client = _build_client()


def is_enabled() -> bool:
    return _client is not None


def save_anomaly(
    *,
    zone_key: str,
    event_type: str,
    score: float,
    risk_level: str,
    increment: float,
    district: str | None,
    pincode: str | None,
    latitude: float | None,
    longitude: float | None,
    payload: dict[str, Any],
) -> None:
    if _client is None:
        return
    try:
        _client.table(ANOMALY_TABLE).insert(
            {
                "zone_key": zone_key,
                "event_type": event_type,
                "score": score,
                "risk_level": risk_level,
                "danger_increment": increment,
                "district": district,
                "pincode": pincode,
                "latitude": latitude,
                "longitude": longitude,
                "payload": payload,
            }
        ).execute()
    except Exception:
        return


def upsert_zone(
    *,
    zone_key: str,
    district: str | None,
    pincode: str | None,
    latitude: float | None,
    longitude: float | None,
    location_label: str | None,
    score: float,
    risk_level: str,
) -> None:
    if _client is None:
        return
    try:
        _client.table(ZONE_TABLE).upsert(
            {
                "zone_key": zone_key,
                "district": district,
                "pincode": pincode,
                "latitude": latitude,
                "longitude": longitude,
                "location_label": location_label,
                "score": score,
                "risk_level": risk_level,
            },
            on_conflict="zone_key",
        ).execute()
    except Exception:
        return


def create_alert(
    *,
    zone_key: str,
    pincode: str | None,
    location_label: str | None,
    title: str,
    message: str,
    severity: str,
    score: float,
) -> None:
    if _client is None:
        return
    try:
        _client.table(ALERT_TABLE).insert(
            {
                "zone_key": zone_key,
                "pincode": pincode,
                "location_label": location_label,
                "title": title,
                "message": message,
                "severity": severity,
                "score": score,
            }
        ).execute()
    except Exception:
        return

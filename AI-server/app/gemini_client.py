from __future__ import annotations

import os
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_API_URL = os.getenv("GEMINI_API_URL", "https://api.example.com/gemini/analyze")


class GeminiError(RuntimeError):
    pass


def analyze_events_report(events: list[dict[str, Any]]) -> dict[str, Any]:
    if not GEMINI_API_KEY:
        raise GeminiError("GEMINI_API_KEY is not set in environment")

    # Build a simple prompt payload summarising recent events
    contents = []
    for e in events:
        contents.append(f"{e['event_time']} {e['event_type']} qty={e['quantity']} intensity={e.get('intensity')} pincode={e.get('pincode')}")

    prompt = {
        "title": "AMR events report",
        "instructions": "Analyze the following recent AMR-related events and produce a short summary, key risks, and recommended actions.",
        "events_text": "\n".join(contents),
        "max_length": 800,
    }

    headers = {
        "Authorization": f"Bearer {GEMINI_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(GEMINI_API_URL, json=prompt, headers=headers)
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError as exc:
        raise GeminiError(f"Gemini API request failed: {exc}") from exc


def predict_event(event: dict[str, Any]) -> dict[str, Any]:
    """Send a single event to Gemini to get a prediction (e.g., predicted risk increment or level).

    The provider-specific input/output schema may need adjustment.
    """
    if not GEMINI_API_KEY:
        raise GeminiError("GEMINI_API_KEY is not set in environment")

    payload = {
        "title": "AMR event prediction",
        "instructions": "Given the event below, predict the expected danger increment and risk level change. Return JSON with keys: predicted_increment (number), predicted_level (low|medium|high), reasoning (short text).",
        "event": event,
        "max_length": 400,
    }

    headers = {
        "Authorization": f"Bearer {GEMINI_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(GEMINI_API_URL, json=payload, headers=headers)
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError as exc:
        raise GeminiError(f"Gemini API request failed: {exc}") from exc


def validate_region(pincode: str | None, district: str | None, score: float | None) -> dict[str, Any]:
    """Ask Gemini whether the given region (pincode/district) should be considered a red/high-risk zone.

    Returns a dict like {"is_red_zone": bool, "reason": str}.
    """
    if not GEMINI_API_KEY:
        raise GeminiError("GEMINI_API_KEY is not set in environment")

    payload = {
        "title": "Validate AMR region risk",
        "instructions": (
            "Decide whether the provided region (pincode/district) with the given score should be classified as a RED (high-risk) zone. "
            "Return JSON with keys: is_red_zone (boolean) and reason (short text)."
        ),
        "region": {"pincode": pincode, "district": district, "score": score},
        "max_length": 200,
    }

    headers = {
        "Authorization": f"Bearer {GEMINI_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.post(GEMINI_API_URL, json=payload, headers=headers)
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError as exc:
        raise GeminiError(f"Gemini API request failed: {exc}") from exc

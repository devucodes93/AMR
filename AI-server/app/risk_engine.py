from __future__ import annotations

from dataclasses import dataclass


@dataclass
class RiskOutput:
    increment: float
    level: str


INTENSITY_WEIGHT = {
    "Low": 1.0,
    "Medium": 1.6,
    "High": 2.3,
}

EVENT_WEIGHT = {
    "doctor": 1.5,
    "pharmacy": 1.2,
    "community": 1.8,
}


def compute_increment(event_type: str, quantity: int, intensity: str | None) -> float:
    event_weight = EVENT_WEIGHT.get(event_type, 1.0)
    intensity_weight = INTENSITY_WEIGHT.get(intensity or "Low", 1.0)
    return float(max(1, quantity)) * event_weight * intensity_weight


def risk_level(score: float) -> str:
    if score >= 60:
        return "high"
    if score >= 25:
        return "medium"
    return "low"

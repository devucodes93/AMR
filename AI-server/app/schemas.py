from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


EventType = Literal["doctor", "pharmacy", "community"]
RiskLevel = Literal["low", "medium", "high"]


class IngestEventRequest(BaseModel):
    event_type: EventType
    event_time: datetime | None = None
    pincode: str | None = None
    district: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    quantity: int = Field(default=1, ge=1)
    intensity: Literal["Low", "Medium", "High"] | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class AnalyzeResponse(BaseModel):
    accepted: bool
    zone_key: str
    score: float
    risk_level: RiskLevel


class ZonePoint(BaseModel):
    pincode: str
    latitude: float | None
    longitude: float | None
    locationLabel: str | None = None
    score: float
    riskLevel: RiskLevel


class ZonesResponse(BaseModel):
    points: list[ZonePoint]
    source: str


class AlertItem(BaseModel):
    id: str
    title: str
    locationLabel: str | None = None
    time: str


class AlertsResponse(BaseModel):
    alerts: list[AlertItem]
    source: str

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "ai_server.db"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            create table if not exists ingested_events (
              id integer primary key autoincrement,
              event_type text not null,
              event_time text not null,
              pincode text,
              district text,
              latitude real,
              longitude real,
              quantity integer not null,
              intensity text,
              danger_increment real not null,
              payload_json text not null,
              created_at text not null
            )
            """
        )
        conn.execute(
            """
            create table if not exists zone_risk (
              pincode text primary key,
              district text,
              latitude real,
              longitude real,
              location_label text,
              score real not null,
              risk_level text not null,
              updated_at text not null
            )
            """
        )
        columns = {
            row[1]
            for row in conn.execute("pragma table_info(zone_risk)").fetchall()
        }
        if "location_label" not in columns:
            conn.execute("alter table zone_risk add column location_label text")
        conn.execute(
            """
            create table if not exists alerts (
              id integer primary key autoincrement,
              pincode text,
              location_label text,
              title text not null,
              message text not null,
              severity text not null,
              score real not null,
              created_at text not null
            )
            """
        )
        alert_columns = {
            row[1]
            for row in conn.execute("pragma table_info(alerts)").fetchall()
        }
        if "location_label" not in alert_columns:
            conn.execute("alter table alerts add column location_label text")


def save_ingested_event(*, event_type: str, event_time: str, pincode: str | None, district: str | None, latitude: float | None, longitude: float | None, quantity: int, intensity: str | None, danger_increment: float, payload: dict) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            insert into ingested_events (
              event_type, event_time, pincode, district, latitude, longitude,
              quantity, intensity, danger_increment, payload_json, created_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_type,
                event_time,
                pincode,
                district,
                latitude,
                longitude,
                quantity,
                intensity,
                danger_increment,
                json.dumps(payload, ensure_ascii=True),
                now_iso(),
            ),
        )


def get_zone(pincode: str):
    with get_conn() as conn:
        return conn.execute(
            "select * from zone_risk where pincode = ?",
            (pincode,),
        ).fetchone()


def upsert_zone(*, pincode: str, district: str | None, latitude: float | None, longitude: float | None, location_label: str | None, score: float, risk_level: str) -> None:
    with get_conn() as conn:
        conn.execute(
            """
                        insert into zone_risk (pincode, district, latitude, longitude, location_label, score, risk_level, updated_at)
                        values (?, ?, ?, ?, ?, ?, ?, ?)
            on conflict(pincode) do update set
              district = excluded.district,
              latitude = coalesce(excluded.latitude, zone_risk.latitude),
              longitude = coalesce(excluded.longitude, zone_risk.longitude),
                            location_label = coalesce(excluded.location_label, zone_risk.location_label),
              score = excluded.score,
              risk_level = excluded.risk_level,
              updated_at = excluded.updated_at
            """,
                        (
                                pincode,
                                district,
                                latitude,
                                longitude,
                                location_label,
                                score,
                                risk_level,
                                now_iso(),
                        ),
        )


def create_alert(*, pincode: str | None, location_label: str | None, title: str, message: str, severity: str, score: float) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            insert into alerts (pincode, location_label, title, message, severity, score, created_at)
            values (?, ?, ?, ?, ?, ?, ?)
            """,
            (pincode, location_label, title, message, severity, score, now_iso()),
        )


def get_recent_alerts(limit: int = 50):
    with get_conn() as conn:
        return conn.execute(
            """
            select id, title, location_label, created_at
            from alerts
            order by created_at desc
            limit ?
            """,
            (limit,),
        ).fetchall()


def get_zone_points(limit: int = 500):
    with get_conn() as conn:
        return conn.execute(
            """
            select pincode, latitude, longitude, location_label, score, risk_level
            from zone_risk
            order by score desc
            limit ?
            """,
            (limit,),
        ).fetchall()


def get_recent_events(limit: int = 100):
    with get_conn() as conn:
        return conn.execute(
            """
            select id, event_type, event_time, pincode, district, latitude, longitude, quantity, intensity, danger_increment, payload_json, created_at
            from ingested_events
            order by created_at desc
            limit ?
            """,
            (limit,),
        ).fetchall()

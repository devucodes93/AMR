# AI-server (FastAPI)

This service ingests new AMR events, computes danger/risk per zone, auto-creates alerts, and exposes red-zone map points.

Best-practice architecture used here:

- Express/Node stores raw records in Supabase.
- Express sends only the new record to AI-server (`/analyze/event`).
- AI-server performs incremental analysis (no full-table reprocessing).
- AI-server stores analyzed outputs in SQLite and can mirror them to Supabase.

## Endpoints

- `GET /health`
- `POST /analyze/event`
- `GET /alerts`
- `GET /zones`

## Run

```bash
cd AI-server
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload
```

## Optional Supabase Mirror For AI Results

Set these environment variables before running AI-server:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional table names (defaults shown):

- `AI_SUPABASE_ANOMALY_TABLE=ai_anomalies`
- `AI_SUPABASE_ZONE_TABLE=ai_zone_risk`
- `AI_SUPABASE_ALERT_TABLE=ai_alerts`

Use migration [backend/supabase/migrations/20260419_add_ai_analysis_tables.sql](backend/supabase/migrations/20260419_add_ai_analysis_tables.sql#L1) in Supabase SQL editor to create the mirror tables.

## Event Payload Example

```json
{
  "event_type": "doctor",
  "event_time": "2026-04-19T10:00:00Z",
  "pincode": "560064",
  "district": "Bengaluru Urban",
  "latitude": 13.1369,
  "longitude": 77.5607,
  "quantity": 3,
  "intensity": "Medium",
  "payload": {
    "diseaseLabel": "UTI",
    "antibioticName": "Amoxicillin"
  }
}
```

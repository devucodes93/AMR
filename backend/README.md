# AMR Backend (Express + Supabase)

## Setup

1. Copy `.env.example` to `.env`
2. Fill Supabase keys
3. Install and run

Optional for email verification redirect links:

- `SUPABASE_EMAIL_REDIRECT_TO=http://localhost:3000`
- `AI_SERVER_URL=http://localhost:8010` (optional, defaults to this)

```bash
npm install
npm run dev
```

Runs on `http://localhost:4000` by default.

## AI Integration

When AI-server is running, the backend automatically:

- Sends every insert from `doctor-events`, `pharmacy-sales`, and `community-signals` to AI-server.
- Serves AI-generated alerts via `GET /api/alerts`.
- Serves AI-generated risk zones via `GET /api/dashboard/risk-map`.

If AI-server is down, the backend falls back to its existing Supabase logic.

## APIs

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/resend-confirmation`
- `GET/POST /api/community-signals`
- `GET /api/alerts`
- `POST /api/escalations`
- `GET/POST /api/doctor-events`
- `GET/POST /api/pharmacy-sales`
- `GET /api/dashboard/summary`
- `GET /api/dashboard/risk-map`

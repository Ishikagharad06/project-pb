# ParkBy — Technical Project Context

## 1. Summary

ParkBy is a full-stack, real-time smart-parking platform made of **four cooperating layers**: an on-premises edge computer-vision layer, a Django cloud backend with a WebSocket real-time channel, a hybrid multi-database persistence layer, and a React SPA frontend.

| Layer | Stack | Role |
|---|---|---|
| Edge (on-site) | Python, Flask, YOLO (Ultralytics), EasyOCR/Tesseract | Runs *at each physical parking site*; detects per-slot occupancy from camera feeds and reads license plates at gates |
| Data bridge | Python (`save_to_mongo.py`) | Polls the edge layer, enriches, and pushes live occupancy into the cloud |
| Backend (cloud) | Django 4.2 + Django REST Framework + Django Channels (ASGI, Daphne) | REST API, JWT auth, booking logic, and WebSocket broadcast of live occupancy |
| Real-time transport | Redis (Channels layer), MongoDB Atlas (live occupancy documents) | Decouples high-frequency IoT-style writes from the relational database |
| Relational database | PostgreSQL (production, via Neon/Supabase) / SQLite (local fallback) | Durable storage: users, locations, zones, slots, bookings |
| Frontend | React 19-style SPA + TypeScript + Vite + Tailwind + Shadcn UI | Customer / owner / admin dashboards, live map, campus map editor |
| State management | React Context (session state) + Zustand (cached live parking data) | Hybrid: contexts for auth/session, Zustand for high-frequency data |
| Maps | Mapbox GL JS + Mapbox Draw (custom rectangle-draw mode) | Discovery map, campus layout editor, hybrid outdoor+indoor navigation |
| Payments | Razorpay | Platform fee + metered parking charge |
| Deployment | Vercel (frontend as static SPA, backend as a Python/WSGI serverless function) | Hosting, with edge scripts explicitly excluded from the deployment |

**Architectural note (important):** the platform's real-time behavior is fundamentally two-tiered. On a persistently-running server, occupancy changes propagate end-to-end via WebSockets (edge → MongoDB → Django watcher thread → Redis Channels → Daphne → browser) in roughly 2–4 seconds. On Vercel's serverless hosting, ASGI/WebSockets and long-running background threads are not available, so the same data is instead served by a REST endpoint (`/api/all-parking/`) that queries MongoDB directly, and the frontend transparently falls back to polling it every 30 seconds. Treat "real-time" in this codebase as *WebSocket-first, polling-fallback*, not WebSocket-only.

## 2. Repository layout

```
backup_park/
├── project_context.md                      # Master business + architecture audit (this doc's source)
├── docs/
│   └── onboarding_and_ai_agent_guide.md     # Local setup, startup order, AI-agent guardrails
├── p.py                                     # Edge: YOLO occupancy detector + local Flask API (5000/8080)
├── a.py                                     # Edge: ANPR (plate recognition) engine + local Flask API (5001)
├── save_to_mongo.py                         # Bridge: polls p.py, upserts to MongoDB, triggers Channels broadcast
├── vercel_app.py                            # Vercel WSGI entrypoint wrapping the Django app
├── pyproject.toml                           # Vercel Python build config + locked dependency list
├── vercel.json                              # Unified monorepo build/routing config
│
├── parkby_backend/                          # Django project
│   ├── Context_backend/README.md            # Detailed backend subsystem audit
│   ├── manage.py
│   ├── requirements.txt
│   ├── parky/                               # Core settings, URLs, ASGI, Celery config
│   └── apps/
│       ├── accounts/                        # Auth, OTP, Google login, roles
│       ├── parking/                         # Locations, zones, slots, layout generator, live watcher
│       ├── bookings/                        # Reservations, sessions, BFS slot allocation
│       ├── payments/                        # Razorpay integration
│       ├── notifications/                   # In-app alerts via Django Signals
│       ├── verification/                    # OCR document verification for owner onboarding
│       └── admin_panel/                     # Admin review endpoints
│
└── parkby_frontend/                         # React + TypeScript + Vite SPA
    ├── Context_frontend/README.md           # Detailed frontend subsystem audit
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    └── src/
        ├── types/ store/ utils/ hooks/ integrations/ contexts/ pages/ components/
```

## 3. Frontend (high level — see `FRONTEND_CONTEXT.md`)

- React SPA with **`react-router-dom`** (unlike a single-`activeTab`-state design — this app has real routes: `/`, `/live-status`, `/search`, `/customer-dashboard`, `/owner-dashboard`, `/admin-login`, `/admin-dashboard`, `/about-us`).
- Hybrid state: **React Context** for session-scoped state (auth, theme, notifications, bookings) and **Zustand** (`useParkingStore`) for the heavy, frequently-updating live parking metadata cache.
- **Mapbox GL JS** for the discovery map, plus a custom **Mapbox Draw** rectangle mode and a bespoke campus-map editor (`MapArchitect.tsx`) for owners to draw zones, roads, gates, and landmarks.
- **Shadcn UI** primitives for the component library; **Framer Motion** for animation; **Spline** for the landing page's 3D hero.
- Talks to the backend via Axios with a **JWT interceptor** (auto-refresh on 401) and consumes live data either over a **WebSocket** (`ws://<host>/ws/parking/`) or, when disconnected, a **30-second REST poll**.

## 4. Backend — Django + Channels (see `BACKEND_CONTEXT.md`)

- Entry points: Django REST Framework for `/api/v1/*` REST routes, Django Channels/Daphne for the `/ws/parking/` WebSocket endpoint.
- Modular app structure (`apps.accounts`, `apps.parking`, `apps.bookings`, `apps.payments`, `apps.notifications`, `apps.verification`, `apps.admin_panel`) — each app owns one bounded piece of the domain.
- Auth is **phone/email + OTP** (SMTP-dispatched) plus **Google OAuth token verification**, issuing **SimpleJWT** access/refresh tokens — this is a materially more complete auth model than a plaintext-password demo.
- A background daemon thread (started from `parky/asgi.py`) runs the `run_parking_watcher` management command: it polls MongoDB for changed occupancy documents and broadcasts diffs into the Redis-backed Channels layer.
- Slot assignment on booking uses a **BFS (breadth-first search) shortest-path allocator** over each location's grid layout, so a driver is always assigned the slot closest to the entrance rather than a random one.

## 5. Database & real-time data (see `DATABASE_CONTEXT.md`)

- **PostgreSQL** (Neon/Supabase in production, local SQLite fallback) — the system of record for users, parking locations, zones, slots, and bookings, via Django's ORM/migrations.
- **MongoDB Atlas** — one collection per parking location (`parking_db.parking_status_<location_key>`), holding the single latest high-frequency occupancy document from that site's edge server. This is intentionally *not* in PostgreSQL — it changes every ~2 seconds and would be a poor fit for a relational schema tied to ORM migrations.
- **Redis** — backs the Django Channels layer (WebSocket pub/sub group `parking_live`) and is not used as a general-purpose cache beyond that.

## 6. Edge computer-vision layer

This is the layer that doesn't exist in a typical CRUD parking app, and is core to ParkBy's pitch of "sensor-less deployment on existing CCTV":

- **`p.py`** — a Flask service running YOLO inference on camera frames to infer per-slot occupancy, exposing `/api/parking/status` (or `/api/status` per the master audit — see naming note in `BACKEND_CONTEXT.md`).
- **`a.py`** — a Flask ANPR service using EasyOCR/Tesseract with Indian state-code correction heuristics, logging gate entry/exit events to a local SQLite database and exposing an SSE live-feed endpoint.
- **`save_to_mongo.py`** — the bridge daemon: polls `p.py` every ~2 seconds, enriches the payload with the location's canonical `location_key`, upserts into MongoDB, and can directly trigger a Channels broadcast.
- These three scripts run **on-premises at each parking site** (e.g. a Raspberry Pi or NUC), not in the cloud, and are explicitly excluded from the Vercel deployment (`.vercelignore`).

## 7. External services / integrations

- **Google OAuth** — login and (separately) Mapbox Directions API access for outdoor routing.
- **Mapbox** — discovery map, campus map editor, and Directions API for outdoor-leg navigation, chain-welded to an internally computed indoor route.
- **Razorpay** — payment gateway for platform fees and metered parking charges.
- **MongoDB Atlas** — managed real-time occupancy store.
- **Supabase** — referenced as an optional CDN/storage target for verification documents and receipts (`integrations/supabase/client.ts`); also referenced as an alternate Postgres provider for `DATABASE_URL` in some environment configs.
- **SMTP (Google/Gmail)** — OTP delivery.
- **Vercel** — hosting for both the static frontend build and the Django backend as a Python/WSGI serverless function.

## 8. Environment variables in use

| Variable | Used by | Purpose |
|---|---|---|
| `DJANGO_SECRET_KEY` | Django | Cryptographic signing key |
| `DEBUG` | Django | Debug mode toggle |
| `ALLOWED_HOSTS` | Django | Allowed host headers |
| `DATABASE_URL` | Django | PostgreSQL connection string (falls back to local SQLite if unset) |
| `MONGO_URI` | Django backend + edge `save_to_mongo.py` | MongoDB Atlas connection string (same variable name reused on both sides) |
| `REDIS_URL` | Django | Channels layer backend |
| `CORS_ALLOWED_ORIGINS` | Django | Comma-separated allowed frontend origins |
| `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | Django | SMTP credentials for OTP |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Django | Payment gateway credentials |
| `GOOGLE_CLIENT_ID` | Django + frontend | Google OAuth client ID (must match on both sides) |
| `PARKING_FLASK_PORT` | Edge (`p.py`, `save_to_mongo.py`) | Overrides default port `5000` for the occupancy detector |
| `ANPR_FLASK_PORT` | Edge (`a.py`) | Overrides default port `5001` for the ANPR engine |
| `LOCATION_KEY` | Edge (`save_to_mongo.py`) | Slug stamped into every MongoDB doc to match `ParkingLocation.location_key` |
| `DJANGO_CHANNEL_URL` | Edge (`save_to_mongo.py`) | Endpoint the bridge posts to for triggering a Channels broadcast |
| `VITE_API_BASE_URL` | Frontend | Production Django API base; falls back to same-origin `/api/v1` if unset |
| `VITE_API_URL` | Frontend | Root URL used to resolve the WebSocket address; falls back to browser origin |
| `VITE_GOOGLE_CLIENT_ID` | Frontend | Google OAuth client ID |
| `VITE_SUPABASE_PROJECT_ID` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_URL` | Frontend | Supabase CDN/storage credentials |

## 9. Known rough edges / things to flag to a new engineer

1. **Serverless real-time is a fallback, not the real thing.** On Vercel, WebSockets and the background watcher thread don't run — everything real-time degrades to 30-second REST polling against a direct MongoDB read. Don't assume `<1s` latency in production without checking which hosting mode is active.
2. **Naming drift on the edge status endpoint** — `BACKEND_CONTEXT.md`-level docs and `project_context.md` disagree on whether `p.py` exposes `/api/parking/status` or `/api/status`; confirm against the live `p.py` source before integrating.
3. **ANPR is logged but not yet displayed.** `a.py` writes real gate events to a local SQLite database and exposes them over REST/SSE, but no dashboard currently renders them — `BookingContext.stopParking()` only *simulates* an ANPR trigger today. This is flagged in the frontend docs as a near-term integration target.
4. **Two edge Flask servers default to the same port (5000)** and must be run with distinct `PARKING_FLASK_PORT` / `ANPR_FLASK_PORT` values when co-located on one machine.
5. **Local files are ephemeral on Vercel.** `db.sqlite3` and `anpr_data.db` must never be relied on in the serverless deployment; both are explicitly excluded via `.vercelignore` along with the edge scripts themselves.
6. **Two dependency manifests for the Python backend** (`requirements.txt` and a root `pyproject.toml`) must be kept in sync manually — Vercel's `uv`-based builder prioritizes `pyproject.toml`, so a package added only to `requirements.txt` will silently be missing in production (`500 Function Invocation Failed`).
7. **Zone-name matching between live camera data and the drawn map is fuzzy by design.** `normalize_zone_name()` / `tokenOverlapScore()` reconcile human-entered zone labels (e.g. `"EN Teachers' Parking"` vs. `"EN trs"`) with a similarity threshold (`0.3`) rather than an exact key — a renamed zone on either side can silently stop matching.
8. **Non-commercial/public/free listings are view-only in the UI**, gated by a client-side rule (`parking_category === 'public' || 'non_commercial' || (rate_2w === 0 && rate_4w === 0)`) rather than a server-enforced flag — worth hardening if this distinction becomes commercially important.

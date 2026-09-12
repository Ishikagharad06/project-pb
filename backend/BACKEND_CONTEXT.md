# ParkBy — Backend Context

The ParkBy backend is a **Django + Django REST Framework + Django Channels (ASGI)** application, paired with a separate **edge computer-vision layer** that runs on-site at each physical parking location. This document covers the cloud backend (Part A) and the edge subsystem (Part B) that feeds it.

---

## PART A — Django cloud backend

### A.1 Stack & libraries

| Purpose | Library |
|---|---|
| Web framework | Django (>=4.2) |
| REST layer | Django REST Framework |
| Real-time / WebSockets | Django Channels + Daphne (ASGI server) |
| Auth tokens | SimpleJWT |
| Background jobs | Celery (config present in `parky/celery.py`) |
| Relational DB driver | psycopg2-binary (Postgres), `dj-database-url` for connection-string parsing |
| Real-time document store | pymongo (MongoDB Atlas) |
| Channel layer backend | Redis |
| Payments | Razorpay SDK |
| Env loading | python-dotenv |

### A.2 Directory structure

```
parkby_backend/
├── manage.py
├── requirements.txt
├── parky/                       # Core config & orchestration
│   ├── settings.py              # SimpleJWT, DATABASES, CHANNEL_LAYERS, CORS
│   ├── urls.py                  # Root URLs -> api/v1/
│   ├── asgi.py                  # ASGI app; starts the background watcher thread
│   └── celery.py                # Celery config for background workers
└── apps/
    ├── accounts/                 # Auth, profiles, Google OAuth, role derivation
    ├── parking/                  # Locations, zones, slots, layout generator, watcher
    ├── bookings/                 # Sessions, extensions, BFS slot allocation
    ├── payments/                 # Platform fee + booking transaction verification (Razorpay)
    ├── notifications/            # In-app alerts, Django Signals -> WebSocket push
    ├── verification/             # OCR-based document verification for owner onboarding
    └── admin_panel/              # Admin review/approval endpoints
```

### A.3 Modular apps

1. **`apps.accounts`** — registration, profiles, role derivation (`customer` / `owner` / `admin`), OTP dispatch via SMTP, Google login token verification.
2. **`apps.parking`** — parking locations, multi-zone boundaries, slot instances, grid coordinates; owns the procedural `layout_generator.py` and coordinates matching against live IoT data.
3. **`apps.bookings`** — reservations, starting/stopping sessions, extensions, and the BFS closest-to-entrance slot allocator.
4. **`apps.payments`** — Razorpay integration models and transaction references for platform fee + booking balances.
5. **`apps.notifications`** — records in-app alerts; uses Django Signals (`post_save`) to push instant updates to connected WebSocket clients.
6. **`apps.verification`** — supports owner onboarding by OCR-verifying uploaded documents (electricity bills, license documents) against submitted details.
7. **`apps.admin_panel`** — endpoints for verifying users and approving/rejecting parking listings.

### A.4 REST API endpoints

All paths are prefixed with `/api/v1/`.

**Authentication & Accounts**

| Method | Endpoint | Description | Auth |
|---|---|---|:---:|
| POST | `/accounts/send-otp/` | Dispatches OTP to email/phone | No |
| POST | `/accounts/verify-otp/` | Verifies OTP, registers on signup, issues JWT | No |
| POST | `/accounts/google-login/` | Validates a Google access token, issues JWT | No |
| GET | `/accounts/profile/` | Retrieves the authenticated user's profile | Yes |
| PATCH | `/accounts/profile/update/` | Updates profile fields | Yes |
| POST | `/accounts/admin/login/` | Authenticates admins via email/password | No |

**Parking Locations & Layouts**

| Method | Endpoint | Description | Auth |
|---|---|---|:---:|
| GET | `/parking/locations/` | Lists approved locations (`?lite=true` for a slim payload) | No |
| GET | `/parking/locations/<uuid>/` | Location detail | No |
| POST | `/parking/my/locations/` | Owner lists a new location (multipart form) | Yes |
| PATCH | `/parking/locations/<uuid>/` | Edit location details | Yes (Owner) |
| GET | `/parking/locations/<uuid>/layout/` | Get grid layout JSON | Yes |
| POST | `/parking/locations/<uuid>/layout/` | Save grid layout JSON | Yes (Owner) |
| POST | `/parking/locations/<uuid>/layout/reset/` | Regenerate layout via the layout generator | Yes (Owner) |
| GET | `/parking/locations/<uuid>/campus-map/` | Get campus map (GeoJSON-style) | No |
| POST | `/parking/locations/<uuid>/campus-map/` | Save campus map data | Yes (Owner) |
| GET | `/parking/locations/nearby/` | Nearby search via Haversine distance (`?lat=&lng=&radius=`) | No |
| GET | `/api/all-parking/` | Aggregated real-time status across locations (overrides raw Mongo `display_name` with the registered location name) | No |

**Bookings & Sessions**

| Method | Endpoint | Description | Auth |
|---|---|---|:---:|
| POST | `/bookings/create/` | Initiates a booking; assigns slot via BFS | Yes |
| POST | `/bookings/<uuid>/confirm-platform-fee/` | Marks the platform fee as paid | Yes |
| GET | `/bookings/my/` | Current user's bookings (paginated) | Yes |
| POST | `/bookings/<uuid>/cancel/` | Cancels a booking; frees the slot | Yes |
| POST | `/bookings/<uuid>/start/` | Simulates gate entry / starts the session | Yes |
| POST | `/bookings/<uuid>/stop/` | Vehicle exits; stops the timer, computes `final_amount` | Yes |
| POST | `/bookings/<uuid>/complete/` | Completes outstanding payment | Yes |
| POST | `/bookings/<uuid>/extend/` | Extends the booking end time | Yes |
| POST | `/bookings/<uuid>/extend-buffer/` | Extends the pre-session wait buffer (max 2×) | Yes |

**Verification & Admin**

| Method | Endpoint | Description | Auth |
|---|---|---|:---:|
| POST | `/verification/electricity/upload/` | Upload electricity bill for OCR matching | Yes |
| POST | `/verification/license/upload/` | Upload license document | Yes |
| POST | `/verification/admin/review/<uuid>/` | Admin approves/rejects a verification | Yes (Admin) |
| GET | `/admin-panel/users/` | Lists registered users | Yes (Admin) |
| POST | `/admin-panel/users/<uuid>/verify/` | Verifies an owner's profile | Yes (Admin) |

### A.5 Real-time watcher & WebSockets architecture

- **Background thread** (`run_parking_watcher`, started from `parky/asgi.py` since Daphne runs single-process): polls PostgreSQL every ~30s for active locations with an approved `location_key`/`mongo_uri`, then polls each location's MongoDB collection (`parking_db.parking_status_<location_key>`) every ~2s for its newest document.
- **Change detection**: hashes each document (excluding `fetched_at`), overrides `display_name` with the PostgreSQL `ParkingLocation.name`, and — if the hash changed — dispatches to the `parking_live` Channels group:
  ```python
  async_to_sync(channel_layer.group_send)(
      "parking_live", {"type": "parking_update", "data": doc}
  )
  ```
- **`apps.parking.consumers.ParkingConsumer`** exposes `/ws/parking/`: adds each connecting client to the `parking_live` group and forwards `parking_update` events as serialized JSON.
- **Live MongoDB document shape:**
  ```json
  {
    "_id": "64bfd589f182c89280a5e8c1",
    "location": "RBU_Ramdeobaba",
    "display_name": "RBU Ramdeobaba",
    "fetched_at": "2026-06-06T11:15:00.000Z",
    "total_capacity": 150,
    "total_vehicles": 85,
    "available": 65,
    "groups": [
      {"name": "EN Teachers' Parking", "capacity": 30, "vehicles": 12, "available": 18, "status": "open", "emergency_closed": false}
    ]
  }
  ```

### A.6 Core algorithms & utilities

- **BFS closest-slot allocator** (`apps.bookings.utils.find_best_slot_bfs`): retrieves the location's `layout_data` grid, runs a breadth-first search from the entrance over walkable cells (`road`, `entrance`, `exit`, `slot`), computes shortest grid-distance to every coordinate, then picks the *available* slot (matching requested vehicle type / zone) with the lowest distance.
- **Collection slug normalization** (`parking_status_collection_name`): lower-cases a location key, replaces non-alphanumerics with `_`, and prefixes `parking_status_`.
- **Zone name normalization** (`normalize_zone_name`): maps loosely-typed zone strings (`"en trs"`, `"en teachers"`, `"en_teachers'_parking"`) to one canonical slug, including basic plural/singular unification.
- **Mongo-to-JSON normalization** (`mongo_document_to_jsonable`): unpacks MongoDB extended-JSON `$date` wrappers on `fetched_at` so the client never sees a raw BSON date object.

### A.7 Environment variables (cloud backend)

| Variable | Purpose |
|---|---|
| `DJANGO_SECRET_KEY` | Cryptographic signing key |
| `DEBUG` | Boolean debug toggle |
| `ALLOWED_HOSTS` | Comma-separated allowed domains |
| `DATABASE_URL` | PostgreSQL connection string (falls back to local `db.sqlite3`) |
| `MONGO_URI` | MongoDB Atlas connection URI |
| `REDIS_URL` | Channels layer host, e.g. `redis://localhost:6379` |
| `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | SMTP credentials for OTP delivery |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Payment gateway credentials |

---

## PART B — Edge server subsystem

Three Python scripts run **on-premises at each physical parking site** (Raspberry Pi, NUC, or industrial PC), forming the real-time data-acquisition pipeline that feeds the cloud backend. They are explicitly excluded from the Vercel deployment.

### B.1 `p.py` — YOLO occupancy detector

| Item | Detail |
|---|---|
| Framework | Flask + Python `threading` |
| Default port | `5000` (override via `PARKING_FLASK_PORT`) |
| Detection model | YOLOv8 / custom weights |
| Concurrency | One background thread per camera; Flask in the main thread |
| Persistence | In-memory only; no local DB writes |
| Filtering | High-aspect-ratio checks to avoid misclassifying standing people as two-wheelers |

**Endpoints (local network only):**

| Method | Path | Description |
|---|---|---|
| GET | `/api/parking/status` | Live occupancy for all monitored groups/slots |
| GET | `/api/parking/groups` | Lists configured groups/zones |
| POST | `/api/parking/emergency` | Toggles emergency-closed flag on a group |
| GET | `/api/parking/snapshot/<group>` | Base64 JPEG snapshot of a live camera view |
| GET | `/health` | Health check |

> Note: `project_context.md`'s architecture summary refers to this same endpoint as `/api/status`. Confirm the live path in `p.py` before integrating against it — treat this as unresolved naming drift, not a deliberate second endpoint.

### B.2 `a.py` — ANPR (Automatic Number Plate Recognition) engine

| Item | Detail |
|---|---|
| Framework | Flask + Python `threading` |
| Default port | `5001` (override via `ANPR_FLASK_PORT`) |
| Preprocessing | ~8 OpenCV filters (contrast equalization, denoising, sharpening, CLAHE) |
| Character segmentation | Vertical projection profiles isolate characters for per-character OCR |
| OCR engines | EasyOCR (primary), Tesseract (fallback) |
| Plate correction | Indian state-code validation/correction heuristic, biased toward `MH` codes |
| Persistence | Local SQLite (`anpr_data.db`) for gate event logs |
| Deduplication | 30-second cooldown per plate |

**Endpoints (local network only):**

| Method | Path | Description |
|---|---|---|
| GET | `/api/anpr/stats` | Total scanned, today's count, unique plates |
| GET | `/api/anpr/recent` | Last N plate-read events |
| GET | `/api/anpr/search?plate=<q>` | Fuzzy substring search over the gate log |
| GET | `/api/anpr/live-feed` | Server-Sent Events stream of new detections |
| POST | `/api/anpr/manual` | Manually logs a plate (operator override) |
| GET | `/health` | Health check |

**SQLite schema (`anpr_data.db`):**
```sql
CREATE TABLE gate_logs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    plate     TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    direction TEXT,      -- 'entry' | 'exit'
    confidence REAL,
    camera_id TEXT
);
```

### B.3 `save_to_mongo.py` — sync bridge (edge → cloud)

Polls `p.py`'s local API (~every 2s), enriches the payload with `location_key`, `fetched_at`, and `source: "edge"`, upserts into `parking_db.parking_status_<location_key>` in MongoDB Atlas, and optionally triggers a Channels broadcast directly.

```
[p.py Flask] --GET /api/parking/status-->
[save_to_mongo.py]
    ├── Validate response JSON
    ├── Inject: location_key, fetched_at, source="edge"
    ├── MongoDB Atlas: upsert({location: key}, enriched_doc)
    └── (On change) POST Django Channels trigger
            └── group_send("parking_live", {"type": "parking_update", "data": doc})
```

### B.4 Port & conflict management

`p.py` and `a.py` both default to port `5000`. When co-located on one machine, they **must** use distinct ports:

```bash
# .env on edge server
PARKING_FLASK_PORT=8080
ANPR_FLASK_PORT=5001
```

`save_to_mongo.py` reads `PARKING_FLASK_PORT` to build its poll URL, so changing the port only requires updating the `.env` file.

### B.5 Edge environment variables

| Variable | Purpose |
|---|---|
| `PARKING_FLASK_PORT` | Overrides `p.py`'s default port (5000) |
| `ANPR_FLASK_PORT` | Overrides `a.py`'s default port (5001) |
| `MONGO_URI` | MongoDB Atlas connection (same variable reused from the cloud side) |
| `DJANGO_CHANNEL_URL` | REST endpoint `save_to_mongo.py` posts to for triggering a broadcast |
| `LOCATION_KEY` | Unique slug (`STATE_CITY_PINCODE_NAME`) stamped into every Mongo document |

---

## Vercel backend deployment

- **Entry point:** `vercel_app.py` at the workspace root, wrapping the Django WSGI app.
- **`pyproject.toml`** pins `[tool.vercel] entrypoint = "vercel_app.py"` (so Vercel's Python builder doesn't mistakenly search for Flask) and lists all backend dependencies under `[project.dependencies]` — Vercel prioritizes this over `requirements.txt`, so new packages must be added here too.
- **ASGI limitation:** serverless function instances don't support persistent WebSocket listeners or long-running threads — the watcher thread and Daphne are bypassed in this mode; the frontend falls back to REST polling.
- **SQLite exclusion:** `db.sqlite3` must not be used in production — `DATABASE_URL` (parsed via `dj-database-url`) must point at a real Postgres instance.
- **CORS:** `CORS_ALLOWED_ORIGINS` (env var) is parsed and appended to Django's allowed origins at startup; same-origin unified deployments bypass CORS entirely.
- **Production URLs:** app at `https://testparkby.vercel.app`; API at `https://testparkby.vercel.app/api/v1`. The same origin must be registered as an Authorized JavaScript Origin in Google Cloud Console for OAuth to work.
- **Production environment checklist:** `DJANGO_SECRET_KEY`, `DEBUG=False`, `ALLOWED_HOSTS`, `DATABASE_URL` (Postgres), `MONGO_URI`, `CORS_ALLOWED_ORIGINS`, `EMAIL_HOST_USER`/`EMAIL_HOST_PASSWORD`, `GOOGLE_CLIENT_ID`.

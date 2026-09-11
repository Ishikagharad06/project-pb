# ParkBy — Backend Context

The repository ships **two independent backend implementations** of the same product. Read `PROJECT_CONTEXT_TECHNICAL.md` §1 first for why they both exist. This document covers each in detail.

---

## PART A — Express / Node.js backend (`server.ts`)

### A.1 Stack & libraries

| Purpose | Library | Version |
|---|---|---|
| HTTP server / routing | express | ^4.21.2 |
| Dev server / SSR-style middleware | vite (`createServer` in middleware mode) | ^6.2.3 |
| Postgres client | pg | ^8.23.0 |
| Env var loading | dotenv | ^17.2.3 |
| AI | @google/genai (Google Gemini SDK) | ^2.4.0 |
| Dev runtime (TS execution without a build step) | tsx | ^4.21.0 |
| Production bundling | esbuild (bundles `server.ts` → `dist/server.cjs`, CJS, Node platform, external packages) | ^0.25.0 |
| Types | @types/express, @types/node, @types/pg | — |

### A.2 Process / startup pipeline

`server.ts` startup sequence (skipped entirely when `process.env.VERCEL` is set, since Vercel invokes the handler per-request instead):
1. `dotenv.config()` loads `.env`.
2. Instantiate Express app, register JSON body parsing + manual CORS middleware (allow all origins/methods/headers).
3. Conditionally construct a Gemini client if `GEMINI_API_KEY` is present.
4. Register all REST routes (see A.4).
5. Run a chain of Neon connectivity/diagnostic checks in sequence: `testNeonConnection()` → `testDatabaseTables()` → `inspectParkingSlots()` → `inspectParkingTables()` → `inspectParkingData()` → `ensurePaymentsTable()` (idempotent `CREATE TABLE IF NOT EXISTS payments`) → `startServer()`.
6. `startServer()` either mounts Vite as SPA middleware (`NODE_ENV !== 'production'`) or serves the pre-built `dist/` static folder + SPA fallback (`NODE_ENV === 'production'`), then binds to `0.0.0.0:3000`.
7. After startup, a `setInterval` runs every 30 seconds calling `completeExpiredNeonBookings()` to auto-transition bookings whose `scheduled_end_time` has passed into a completed state and free their slots.

### A.3 Two data-access paths inside this one server

1. **In-memory mock store** — `src/db/store.ts`, a single `ParkingDatabase` class instance (`db`) holding hardcoded arrays for users, locations, slots, vehicles, pricing, FAQs, bookings, and an in-memory `Map` of chat conversations. State resets on every server restart. Backs: auth endpoints, `/api/users`, `/api/locations` GET/POST, `/api/slots` POST, `/api/pricing`, `/api/chat/history/:sessionId`, and the chatbot's own internal demo booking (`db.bookSlot`, `db.extendBooking`) used only inside `handleChat`.
2. **Neon Postgres via `pg`** — `src/db/neon.ts` (336 lines), containing hand-written parameterized SQL for the real "Pay & Park" flow: fetching live slots with joined pricing (`getNeonSlots`, `getNeonSlotById`), booking lifecycle (`createNeonBooking`, `activateNeonBooking`, `extendNeonBooking`, `cancelNeonBooking`, `completeExpiredNeonBookings`), user booking history (`getNeonUserBookings`), payments (`createNeonPayment`, `ensurePaymentsTable`), and slot status mutation (`markSlotOccupied`).

There is also a third, unused-by-`server.ts`-directly helper, `db.ts` at the repo root, which just exports a `pg.Pool` and a `testDatabaseConnection()` helper — appears to be an earlier/simpler version of the Neon connection logic, superseded by `src/db/neon.ts`.

### A.4 REST endpoints (Express)

| Method | Path | Data source | Purpose |
|---|---|---|---|
| POST | `/api/auth/google` | in-memory store | Google-style auth: creates user w/ ₹500 bonus if new, else logs in |
| POST | `/api/auth/logout` | — | No-op success response |
| GET | `/api/users` | in-memory store | List all users |
| POST | `/api/auth/signup` | in-memory store | Email/password registration |
| POST | `/api/auth/login` | in-memory store | Email/password login |
| GET | `/api/health` | — | Health check |
| GET | `/api/locations` | in-memory store | List parking locations |
| POST | `/api/locations` | in-memory store | Create a new location (admin) |
| GET | `/api/slots` | **Neon** | List slots (optionally filtered by `location`, `type`) with live pricing |
| POST | `/api/slots` | in-memory store | Create a new slot (admin) — note: writes to the mock store, not Neon |
| GET | `/api/pricing` | in-memory store | List pricing rules |
| GET | `/api/bookings/my?user_id=` | **Neon** | List a user's bookings; also triggers expiry sweep first |
| POST | `/api/bookings` | **Neon** | Step 1 of Pay & Park: reserve a slot, create a `pending` booking, mark slot occupied |
| POST | `/api/payments` | **Neon** | Step 2 of Pay & Park: mock-charge payment (always succeeds), activate the booking |
| POST | `/api/bookings/extend` | **Neon** | Extend an active booking's end time and recompute total |
| POST | `/api/bookings/cancel` | **Neon** | Cancel a booking and free its slot |
| GET | `/api/chat/history/:sessionId` | in-memory store | Retrieve chat message history for a session |
| POST | `/chat` and `/api/chat` | in-memory store (both, same handler) | Rule-based intent detection + optional Gemini AI reply generation |

### A.5 Chat / AI pipeline (Express side)

1. Record the incoming user message into the in-memory conversation store.
2. `detectIntent(message)` — simple keyword matching against `INTENT_KEYWORDS` map (`greeting`, `availability`, `booking`, `extension`, `rates`, `hours`, `payment`, `cancellation`, `support`, else `fallback`).
3. Depending on intent, gather `contextData` from the mock store: available slots, booking result (via `extractSlotId` regex `\b([A-Za-z]\d)\b`), extension result, FAQ answer + pricing, plus always-included active bookings and all locations.
4. **If** `GEMINI_API_KEY` configured: call `aiClient.models.generateContent({ model: 'gemini-2.5-flash', ... })` with a system instruction constraining the model to only state facts present in `contextData` (to prevent hallucinating slots/prices) at `temperature: 0.3`.
5. **Else / on Gemini failure:** fall back to `generateTemplateReply(intent, contextData)`, a fully deterministic string-template responder.
6. Record the AI/template reply back into the conversation store and return `{ reply, intent, session_id, data }`.

---

## PART B — Django REST Framework backend (`backend/` + `api/`)

### B.1 Stack & libraries

| Purpose | Library | Version (requirements.txt) |
|---|---|---|
| Web framework | Django | >=4.2.0 |
| REST layer | djangorestframework | >=3.14.0 |
| CORS | django-cors-headers | >=4.3.0 |
| Env loading | python-dotenv | >=1.0.0 |
| Postgres driver | psycopg2-binary | >=2.9.9 |
| WSGI server (production) | gunicorn | >=21.2.0 |
| DB URL parsing | dj-database-url | >=2.1.0 |

### B.2 Project layout

- `backend/settings.py` — loads `django.env`; picks **Postgres** (via `dj_database_url.parse(DATABASE_URL, ssl_require=True)`) if `DATABASE_URL` is set and isn't a placeholder/sqlite string, else falls back to local **SQLite** (`db.sqlite3`). `CORS_ALLOW_ALL_ORIGINS = True`. DRF configured with `AllowAny` permissions everywhere (no auth enforcement) and JSON/Form/MultiPart parsers.
- `backend/urls.py` — mounts `api/` include, Django admin at `/admin/`, a `root_api` info view at `/`, and exposes the chat endpoint at bare `/chat` too (to match the frontend's `ChatWidget.tsx`, which calls `/chat` directly rather than `/api/chat`).
- `api/models.py` — see `DATABASE_CONTEXT.md`.
- `api/serializers.py` — plain `ModelSerializer`s (`fields = '__all__'`) for `UserProfile`, `ParkingSlot`, `ParkingLocation` (nests slots as read-only), `Booking`.
- `api/views.py` — function-based `@api_view` views (no class-based ViewSets/routers).
- `api/management/commands/seed.py` — idempotent (`get_or_create`) seeding of one demo admin user, 3 Gurugram-based locations, and 6 slots.

### B.3 REST endpoints (Django)

Base path `/api/` unless noted:

| Method | Path | Purpose |
|---|---|---|
| GET | `/` (root, no prefix) | API info/discovery (`root_api`) |
| GET | `/api/health/` | Health check |
| GET, POST | `/api/auth/google/` | Google-style auth (create-if-missing) |
| POST | `/api/auth/signup/` | Email/password registration |
| POST | `/api/auth/login/` | Email/password login |
| POST | `/api/auth/logout/` | No-op success |
| GET, POST | `/api/locations/` | List / create parking locations |
| GET, POST | `/api/slots/` | List / create parking slots |
| GET | `/api/bookings/my/` | List the hardcoded demo user's bookings |
| POST | `/api/bookings/` | Create a booking (checks slot availability, sets slot to `occupied`) |
| POST | `/api/bookings/extend/` | Extend an active booking |
| POST | `/api/bookings/cancel/` | Cancel a booking, free the slot |
| POST | `/api/chat/` and `/chat` (root) | Rule-based chat assistant (no external AI call) |

### B.4 Chat pipeline (Django side)

Entirely deterministic, no external AI dependency:
1. `_detect_intent(message)` — same style of keyword matching as the Express version (separate, slightly different `INTENT_KEYWORDS` dict defined locally in `views.py`).
2. For `availability`/`greeting`: query `ParkingSlot.objects.filter(status='available').select_related('parking')` and format a bullet list reply directly in Python (no LLM).
3. For `booking`: `_extract_slot_number` regex `\b([A-Za-z])-?0*(\d+)\b` matches user text against real seeded slot numbers like `A-01`, creates a real `Booking` row and flips the `ParkingSlot.status` to `occupied` directly in the database.
4. For FAQ-style intents (`rates`, `hours`, `payment`, `cancellation`, `support`): looks up a static `FAQS` dict.
5. Returns `{ reply, intent, session_id, data }` — same response shape as the Express `/chat`, but every reply is templated/rule-based (Django backend has no Gemini integration).

### B.5 Auth & demo-user caveat (both backends)

Neither backend implements real session/token authentication:
- Express: plaintext password comparison against the in-memory store (`db.loginUser`), no hashing.
- Django: `UserProfile.password` is a plain `CharField`; `auth_login` does a direct string comparison (`user.password != password`) — **not** using Django's built-in hashed-password auth system.
- Django's non-chat booking endpoints (`bookings_my`, `bookings_create`) are hardcoded to a single `DEMO_USER_ID = 'usr-demo'` / `DEMO_USER_EMAIL` rather than reading the authenticated user from the request.

This is acceptable for a prototype/demo but **must not be treated as production-ready auth** — flag clearly if this project is scoped for a real deployment with real user accounts and money movement.

### B.6 Deployment

- `vercel.json` builds `api/index.ts` (a TypeScript entry point, presumably wrapping the Express app for serverless — see `PROJECT_CONTEXT_TECHNICAL.md`) using `@vercel/node`, and routes all `/api/*` traffic to it. This implies the **Express** backend, not Django, is the one intended for the Vercel deployment path; the Django backend would need a separate deployment target (e.g. a traditional WSGI host, Render, Railway, or a Vercel Python function setup) not represented in this repo's config.
- Production Node build: `vite build` (frontend) + `esbuild server.ts → dist/server.cjs`, run via `node dist/server.cjs` (or `npm start`).
- Production Django: would typically run via `gunicorn backend.wsgi:application` (gunicorn is in `requirements.txt`), though no explicit `Procfile`/`gunicorn` invocation script was found in the reviewed files.

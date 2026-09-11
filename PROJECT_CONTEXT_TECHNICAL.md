# ParkBy — Technical Project Context

## 1. Summary

ParkBy is a full-stack smart-parking reservation platform. The repository contains **two parallel, mostly-overlapping backend implementations** targeting the same domain (parking locations, slots, bookings, payments, chat) plus a single React/TypeScript frontend:

| Layer | Stack | Role |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite 6 + Tailwind CSS v4 | Single-page app UI |
| Backend A (**live/primary**) | Node.js + Express 4 + TypeScript (`server.ts`), `tsx`/`esbuild` | Serves the SPA and all `/api/*` + `/chat` routes actually called by the frontend; talks directly to Postgres via `pg` |
| Backend B (**secondary/parallel**) | Python 3 + Django 4.2 + Django REST Framework | A REST API implementation of the same domain (locations, slots, bookings, chat) with Django ORM models & migrations; not currently wired to the frontend's `apiConfig.ts` base URL by default |
| Database | PostgreSQL (Neon serverless Postgres) in production; SQLite fallback for local/Django-only use | Persistent storage |
| AI | Google Gemini (`@google/genai`, model `gemini-2.5-flash`) | Powers the natural-language chat assistant, with a rule-based template fallback |
| Deployment target | Vercel (`vercel.json` builds `api/index.ts` as a serverless function) | Hosting |

**Architectural note (important):** The frontend (`src/apiConfig.ts`, all `fetch()` calls) talks to relative paths like `/api/locations`, `/api/slots`, `/api/bookings`, and `/chat`. In the current repo, these are implemented twice:
- Once in `server.ts` (Express) — calling Neon Postgres directly via hand-written SQL in `src/db/neon.ts`, plus an **in-memory mock store** (`src/db/store.ts`) used only by the chat widget's own lightweight demo bot logic.
- Once in Django (`api/views.py`, `api/urls.py`, `backend/urls.py`) — using the Django ORM against `api/models.py`, persisted to Postgres (via `DATABASE_URL`) or SQLite fallback.

Both implementations expose nearly identical endpoint shapes (`/api/locations`, `/api/slots`, `/api/bookings`, `/api/bookings/extend`, `/api/bookings/cancel`, `/api/auth/*`, `/chat` or `/api/chat`). Only one should be running against a given frontend deployment at a time — check `vite.config.ts`'s dev proxy (`/api` → `http://127.0.0.1:8000`, i.e. Django) versus `npm run dev` (which runs `tsx server.ts`, i.e. Express on port 3000) to see which was active for a given run. Treat this repo as **two candidate backends for the same product**, not a single unambiguous system, when reasoning about "the" backend.

## 2. Repository layout

```
project/
├── src/                      # React frontend source
│   ├── components/           # UI components (modals, navbar, chat widget, etc.)
│   ├── db/
│   │   ├── store.ts          # In-memory mock DB used by the Express chat demo path
│   │   └── neon.ts           # Raw `pg` queries against Neon Postgres (bookings/payments/slots)
│   ├── apiConfig.ts           # API_BASE_URL (same-origin by default)
│   ├── types.ts               # Shared TypeScript domain types
│   ├── App.tsx                 # Root component, app-level state & data fetching
│   └── main.tsx                # React entry point
├── server.ts                  # Express server: REST API + Vite middleware/static hosting
├── db.ts                      # Separate/simple `pg` Pool helper (Neon connection test)
├── api/                        # Django app
│   ├── models.py               # Django ORM models (UserProfile, ParkingLocation, ParkingSlot, Booking)
│   ├── serializers.py
│   ├── views.py                # Django REST Framework view functions (mirrors Express routes)
│   ├── urls.py
│   ├── migrations/
│   ├── management/commands/seed.py   # `python manage.py seed`
│   └── index.ts                # Vercel serverless entry point for the API build
├── backend/                    # Django project config
│   ├── settings.py             # DB selection (Postgres via DATABASE_URL, else SQLite), CORS, DRF config
│   ├── urls.py
│   └── wsgi.py
├── database/
│   ├── README.md                # Database docs
│   ├── ER_DIAGRAM.md            # Mermaid ER diagram
│   ├── seed.sql
│   └── indexes.sql
├── schema.sql                   # Canonical raw SQL schema (Postgres/MySQL/SQLite compatible)
├── manage.py                    # Django CLI
├── package.json                 # Node/frontend dependencies & scripts
├── requirements.txt              # Python/Django dependencies
├── vite.config.ts                # Vite dev server + dev proxy to Django (127.0.0.1:8000)
├── vercel.json                   # Vercel build/routing config for api/index.ts
├── tsconfig.json
├── django.env / .env             # Environment variables (not committed with real secrets)
└── db.sqlite3, *.json backups     # Local SQLite DB + JSON export/backup snapshots from migration work
```

## 3. Frontend (high level — see `FRONTEND_CONTEXT.md` for detail)

- **React 19** function components with hooks (`useState`, `useEffect`); no external state-management library (no Redux/Zustand) — state lives in `App.tsx` and is passed down via props.
- **Vite 6** as the dev server/bundler, with `@vitejs/plugin-react` and `@tailwindcss/vite`.
- **Tailwind CSS v4** utility classes for styling.
- **lucide-react** for icons, **motion** (Framer Motion successor) for animation.
- Client persists the logged-in user to `localStorage` (`parkby_user` key) so the "session" survives page reloads (no real auth tokens/cookies are used).
- Talks to the backend exclusively via `fetch()` calls to relative paths (`/api/...`, `/chat`), resolved through `API_BASE_URL` in `apiConfig.ts` (empty string by default = same origin).

## 4. Backend A — Express/Node (see `BACKEND_CONTEXT.md` for full endpoint list)

- Entry point: `server.ts`. Run via `npm run dev` (uses `tsx`, no separate build step) or built for production with `vite build` (frontend) + `esbuild` (bundles `server.ts` → `dist/server.cjs`), then run with `node dist/server.cjs`.
- Uses `express.json()` + a manual CORS middleware (`Access-Control-Allow-Origin: *`).
- Two data layers coexist inside this one server:
  1. `src/db/store.ts` — an **in-memory** class-based mock database (`ParkingDatabase`) with hardcoded seed data for locations/slots/users/bookings/FAQs/chat conversations. Used by the legacy `db.bookSlot()`-style logic embedded in the chat handler (`handleChat`) for its own demo booking flow, and by `/api/auth/*`, `/api/users`, `/api/locations` (GET/POST), `/api/slots` (POST), `/api/pricing`, `/api/chat/history/:sessionId`.
  2. `src/db/neon.ts` — real **Postgres (Neon)** queries via the `pg` library. Used by the "Pay & Park" booking flow: `GET /api/slots`, `GET /api/bookings/my`, `POST /api/bookings`, `POST /api/payments`, `POST /api/bookings/extend`, `POST /api/bookings/cancel`. Includes a `setInterval` background job (every 30s) that auto-completes bookings whose scheduled end time has passed.
- AI chat: if `GEMINI_API_KEY` is set, calls Google's Gemini (`gemini-2.5-flash`) with a system prompt constrained to the app's own context data (to avoid hallucinated slots/prices); otherwise falls back to `generateTemplateReply()`, a deterministic keyword/intent-based responder (`detectIntent`, `extractLocation`, `extractSlotId`).

## 5. Backend B — Django REST Framework (see `BACKEND_CONTEXT.md` for full endpoint list)

- Django 4.2 project (`backend/`) with a single app (`api/`).
- Models: `UserProfile`, `ParkingLocation`, `ParkingSlot`, `Booking` (see `DATABASE_CONTEXT.md`), all with custom string primary keys (not Django's default auto-increment integers) and explicit composite indexes.
- Views are plain DRF `@api_view` function-based views (no ViewSets/routers), covering auth (Google/email signup/login/logout), locations, slots, bookings (create/extend/cancel/list), and a self-contained rule-based `chat_assistant` endpoint that reads/writes real `ParkingSlot`/`Booking` rows directly (no external AI call on this side — it's fully deterministic, `FAQS` dict + `INTENT_KEYWORDS` matching).
- Has a hardcoded `DEMO_USER_ID` / `DEMO_USER_EMAIL` in `views.py` — there is no real session/auth layer; every booking is attributed to one demo account.
- Seed data provided via a custom management command: `python manage.py seed` (see `api/management/commands/seed.py`).
- Runs on port 8000 by default (`python manage.py runserver 8000`); `vite.config.ts` proxies `/api` requests there during local dev if the developer chooses this backend.

## 6. Database (see `DATABASE_CONTEXT.md` for full schema)

- **Production target:** PostgreSQL, specifically **Neon** (serverless Postgres) — connection via `DATABASE_URL` env var, SSL required.
- **Local/offline fallback:** SQLite (`db.sqlite3`), used automatically by Django's `settings.py` when `DATABASE_URL` is unset or a placeholder.
- Canonical schema described in two places that should agree: `schema.sql` (raw SQL, used for direct psql/sqlite3/mysql import) and `api/models.py` (Django ORM, source of truth for the Django backend's migrations).
- Core tables: `users`, `parking_locations`, `parking_slots`, `vehicles`, `pricing_rules` (Django side calls this `parking_pricing` in the Neon-facing SQL in `src/db/neon.ts` — **naming inconsistency to be aware of**), `bookings`, `chat_messages`, and a Node-only `payments` table created on the fly by `ensurePaymentsTable()` in `src/db/neon.ts`.
- Multiple **stale/backup artifacts** exist in the repo root that are not part of the live schema definition: `db.sqlite3.safe-backup`, `db_sqlite_before_neon.sqlite3`, `sqlite_api_data.json`, `sqlite_api_data_utf8.json`, `sqlite_backup.json` — these look like point-in-time exports taken during a SQLite → Neon migration and are historical, not authoritative.

## 7. External services / integrations

- **Google Gemini API** (`@google/genai`) — conversational AI for the chat widget (Express path only).
- **Neon Postgres** — managed serverless Postgres, accessed via `DATABASE_URL` connection string with SSL.
- **DiceBear API** (`api.dicebear.com`) — generates placeholder avatar images from a user's email seed on signup, referenced in both the Node and Django auth code.
- **Vercel** — deployment target; `vercel.json` builds `api/index.ts` as a Node serverless function and routes `/api/*` to it.

## 8. Environment variables in use

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | Express (`server.ts`, `db.ts`, `src/db/neon.ts`) and Django (`backend/settings.py`) | Postgres/Neon connection string |
| `GEMINI_API_KEY` | Express (`server.ts`) | Google Gemini API key for AI chat |
| `SECRET_KEY` | Django (`backend/settings.py`) | Django cryptographic secret |
| `DEBUG` | Django | Debug mode toggle |
| `ALLOWED_HOSTS` | Django | Allowed host header values |
| `CORS_ALLOW_ALL_ORIGINS` | Django (referenced conceptually; hardcoded `True` in settings) | CORS policy |
| `PORT` | Present in `.env` — not directly read in the reviewed Express/Django code (Express hardcodes `PORT = 3000`; Django's port is passed on the CLI) | Likely a deployment-platform convention |
| `VITE_API_BASE_URL` | Frontend (`src/apiConfig.ts`) | Optional override if API is hosted on a different origin |
| `DISABLE_HMR` | `vite.config.ts` | Disables Vite hot-module-reload/watch (useful in constrained sandboxes) |
| `VERCEL` | `server.ts` | Skips local Neon startup checks/server bootstrap when running as a Vercel serverless function |
| `APP_URL` | Referenced in `.env.example` comments (Google AI Studio / Cloud Run context) | Self-referential app URL, not consumed directly in the code reviewed |

⚠️ The uploaded project includes `.env`, `django.env`, and `django.env.backup` files. These were **not read or reproduced here** — treat them as containing real secrets, rotate/redact before sharing this repo, and never commit them to version control.

## 9. Known rough edges / things to flag to a new engineer

1. **Duplicate backend implementations** (Express+Neon vs. Django+DRF) covering the same product surface — needs an explicit decision on which one is canonical going forward, and the other should likely be archived or clearly labeled as a spike.
2. **Two data-access layers inside the Express server itself** (in-memory `store.ts` vs. real `neon.ts` Postgres queries) depending on which route/feature you hit — easy to be confused about where a given field actually lives.
3. **No real authentication** — both backends use email-only "login" (Django even allows login with no password stored) or a hardcoded demo user; there is no password hashing visible in the Django `UserProfile` model (`password` is stored as plain `CharField`) and no session/JWT/token issuance.
4. **Payments are fully mocked** — `POST /api/payments` in `server.ts` always sets `paymentSucceeded = true`; there's no real gateway integration (Razorpay/Stripe) yet, though the code comments explicitly flag this as the intended swap-in point.
5. **Naming drift between `pricing_rules` (schema.sql/Django) and `parking_pricing` (Neon raw SQL in `src/db/neon.ts`)** — confirm which name is actually live in the Neon database before writing new queries against it.
6. Several stale database export/backup files live in the repo root and can be safely ignored for schema purposes (see §6).

# ParkBy — Database Context

## 1. Engine & hosting

- **Production / primary:** PostgreSQL, specifically **Neon** (serverless Postgres). Connection is via a single `DATABASE_URL` connection string (SSL required), consumed by:
  - `src/db/neon.ts` and `db.ts` (Node `pg` driver) — the live Express backend's real data path.
  - `backend/settings.py` (`dj_database_url.parse(..., ssl_require=True)`) — the Django backend, if `DATABASE_URL` is a real (non-placeholder, non-`sqlite`) value.
- **Local/offline fallback:** SQLite, file `db.sqlite3` at the repo root, used automatically by Django when `DATABASE_URL` is unset/placeholder. The Node backend does **not** have a SQLite fallback — it hard-requires `DATABASE_URL` (`src/db/neon.ts` throws if missing).
- **Migration tooling:** Django migrations live in `api/migrations/` (`0001_initial.py`, `0002_...`, `0003_...`) and are the authoritative way to evolve the schema on the Django/ORM side. The Node side has no migration tool — `schema.sql` and ad-hoc `CREATE TABLE IF NOT EXISTS` calls in `src/db/neon.ts` (for `payments`) are how its tables get created.

## 2. Canonical schema (`schema.sql`)

Raw SQL, documented as compatible with PostgreSQL/MySQL/SQLite, containing `CREATE TABLE IF NOT EXISTS` for every core table plus indexes and seed `INSERT`s.

### `users`
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(64) PK | e.g. `usr-demo` |
| name | VARCHAR(255) | |
| email | VARCHAR(255) UNIQUE NOT NULL | login identity |
| password | VARCHAR(255) | **stored in plain text in this schema/seed data** — see security note below |
| role | VARCHAR(32) DEFAULT 'user' | `user` \| `admin` |
| phone | VARCHAR(32) | |
| wallet_balance | DECIMAL(10,2) DEFAULT 500.00 | signup bonus |
| avatar_url | TEXT | DiceBear-generated |
| auth_provider | VARCHAR(32) DEFAULT 'email' | `email` \| `google` |
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | |

### `parking_locations`
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(64) PK | e.g. `loc-1` |
| name, address, city | text fields | |
| latitude, longitude | DECIMAL(10,6) | default Delhi-NCR coordinates (28.4595, 77.0266) |
| total_slots | INT DEFAULT 30 | |
| opening_time, closing_time | VARCHAR(32) | free-text ("06:00", "24 Hours") — not a strict TIME type |
| status | VARCHAR(32) DEFAULT 'active' | `active` \| `inactive` |
| created_at | TIMESTAMP | |

### `parking_slots`
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(64) PK | e.g. `s1`, `slot-A1` |
| parking_id | VARCHAR(64) FK → parking_locations(id) ON DELETE CASCADE | |
| slot_number | VARCHAR(32) | e.g. `A-01` |
| slot_type | VARCHAR(32) DEFAULT 'regular' | `regular` \| `ev` \| `disabled`/`accessible` (see naming note) |
| status | VARCHAR(32) DEFAULT 'available' | `available` \| `occupied` \| `maintenance` |
| price_per_hr | DECIMAL(8,2) DEFAULT 20.00 | |

### `vehicles`
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(64) PK | |
| user_id | VARCHAR(64) FK → users(id) ON DELETE CASCADE | |
| registration_number | VARCHAR(64) UNIQUE NOT NULL | |
| vehicle_type | VARCHAR(32) DEFAULT 'car' | `car` \| `bike` \| `ev` \| `suv` |
| model, color | text fields | |

### `pricing_rules` (schema.sql name) / `parking_pricing` (name used in live Neon SQL — see naming note)
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(64) PK | |
| parking_id | VARCHAR(64) FK → parking_locations(id) ON DELETE CASCADE | |
| vehicle_type | VARCHAR(32) | |
| hourly_rate, daily_rate | DECIMAL(8,2) | |
| *(Neon-side only)* effective_from, effective_until | timestamp-like | Referenced in `src/db/neon.ts`'s `LEFT JOIN LATERAL` price lookup, allowing time-bounded pricing; not present in `schema.sql`'s simpler definition — the live Neon table has evolved beyond the checked-in `schema.sql`. |

### `bookings`
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(64) PK | e.g. `bk-<timestamp>` |
| user_id | VARCHAR(64) FK → users | |
| parking_id | VARCHAR(64) FK → parking_locations | |
| parking_name | VARCHAR(255) | denormalized copy for display convenience |
| slot_id | VARCHAR(64) FK → parking_slots | |
| slot_number | VARCHAR(32) | denormalized |
| vehicle_number | VARCHAR(64) | |
| start_time | TIMESTAMP NOT NULL | |
| scheduled_end_time | TIMESTAMP NOT NULL | |
| actual_end_time | TIMESTAMP nullable | set on cancel/complete |
| status | VARCHAR(32) DEFAULT 'active' | `pending` \| `active` \| `completed` \| `cancelled` \| `expired` |
| base_amount, extension_amount, total_amount | DECIMAL(10,2) | `total = base + extension` |
| created_at | TIMESTAMP | |

### `chat_messages`
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(64) PK | |
| conversation_id | VARCHAR(64) | |
| sender | VARCHAR(16) | `user` \| `ai` |
| message | TEXT | |
| intent | VARCHAR(64) nullable | |
| created_at | TIMESTAMP | |

### `payments` (Neon-only, created at runtime by `src/db/neon.ts::ensurePaymentsTable()`, not in `schema.sql`)
| Column | Type | Notes |
|---|---|---|
| id | VARCHAR(64) PK | |
| booking_id | VARCHAR(64) NOT NULL | not declared as an FK in the `CREATE TABLE IF NOT EXISTS` statement |
| user_id | VARCHAR(64) | |
| amount | DECIMAL(10,2) NOT NULL | |
| payment_method | VARCHAR(32) NOT NULL | |
| status | VARCHAR(32) DEFAULT 'pending' | `pending` \| `success` \| `failed` |
| transaction_id | VARCHAR(128) | e.g. `TXN-XXXXXXXX` |
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | |

## 3. Indexes (`database/indexes.sql`, superset of the ones inline in `schema.sql`)

| Index | Table(columns) | Purpose |
|---|---|---|
| idx_users_email (UNIQUE) | users(email) | Fast auth lookup |
| idx_users_role | users(role) | Admin vs user filtering |
| idx_locations_city | parking_locations(city) | Location search |
| idx_locations_city_status | parking_locations(city, status) | Active locations in a city |
| idx_slots_parking | parking_slots(parking_id) | All slots for a facility |
| idx_slots_status | parking_slots(status) | Filter by availability |
| idx_slots_type | parking_slots(slot_type) | Filter by regular/EV/accessible |
| idx_slots_parking_type_status | parking_slots(parking_id, slot_type, status) | Compound: available EV slots at one location |
| idx_bookings_user | bookings(user_id) | A user's bookings |
| idx_bookings_status | bookings(status) | Active reservation monitoring |
| idx_bookings_parking | bookings(parking_id) | Bookings by location |
| idx_bookings_user_status | bookings(user_id, status) | Compound: a user's active bookings |
| idx_bookings_slot_time | bookings(slot_id, start_time, scheduled_end_time) | Time-range/collision checks |
| idx_vehicles_registration (UNIQUE) | vehicles(registration_number) | Plate lookup |
| idx_vehicles_user | vehicles(user_id) | A user's vehicles |
| idx_chat_conversation | chat_messages(conversation_id) | Chat history retrieval |
| idx_chat_created_at | chat_messages(created_at) | Chronological ordering |

The Django ORM side (`api/models.py`) independently declares its own equivalent composite indexes via `class Meta: indexes = [...]` (e.g. `idx_user_email`, `idx_loc_city_status`, `idx_slot_parking_status`, `idx_booking_user_status`) — functionally overlapping with `database/indexes.sql` but defined separately, so if the schema changes, **both index definitions need to be kept in sync manually.**

## 4. Entity relationships

```
users (1) ───< bookings >─── (1) parking_locations
  │                                  │
  └──< vehicles                     └──< parking_slots ───< bookings
                                          │
parking_locations ──< pricing_rules/parking_pricing
bookings ──< payments   (Neon-only table)
chat_messages            (standalone, keyed by conversation_id, no FK)
```

Full Mermaid ER diagram is maintained separately in `database/ER_DIAGRAM.md` — keep that file's field lists in sync with `schema.sql` and `api/models.py` when the schema changes.

## 5. Django ORM models (`api/models.py`) — how they map to the SQL schema

- `UserProfile` → `users` table equivalent. Same fields as `schema.sql`'s `users`, indexed on `email` and `role`.
- `ParkingLocation` → `parking_locations` equivalent, plus explicit `latitude`/`longitude` defaults matching Delhi-NCR. Indexed on `city` and `(city, status)`.
- `ParkingSlot` → `parking_slots` equivalent, adds a `floor` field (`VARCHAR`, default `'Ground Floor'`) not present in `schema.sql`. FK to `ParkingLocation` via `related_name='slots'`. Indexed on `(parking, status)` and `(slot_type, status)`.
- `Booking` → `bookings` equivalent, with explicit FKs to `ParkingLocation`, `ParkingSlot`, and `UserProfile` (rather than loose string IDs as in raw SQL). Indexed on `(user, status)` and `(parking, status)`.
- Django does **not** define ORM models for `vehicles`, `pricing_rules`/`parking_pricing`, `chat_messages`, or `payments` — those exist only as raw SQL / Neon-side tables consumed directly by the Express backend's `pg` queries, not through Django.

## 6. Data-loading / seeding pipelines

There are **three separate, overlapping ways** to seed the same demo data — keep this in mind when debugging "why is my data different from the docs":

1. **`schema.sql`** — a single file with `CREATE TABLE` + `INSERT ... ON CONFLICT DO NOTHING` statements for `users`, `parking_locations`, `parking_slots`, `vehicles`. Run directly against Postgres/MySQL/SQLite (`psql -f schema.sql`, `sqlite3 db.sqlite3 < schema.sql`, etc). Uses `slot_type = 'disabled'` for the third slot type.
2. **`database/seed.sql`** — a near-duplicate seed script (same three locations, same six slots) but uses `slot_type = 'accessible'` instead of `'disabled'`, a placeholder `'hashed_pass_123'` password, and different vehicle plate numbers (`HR26...` vs `MH12...` in `schema.sql`). **This is a source of real data drift between the two seed files** — pick one as canonical before relying on either.
3. **`python manage.py seed`** (`api/management/commands/seed.py`) — a Django management command using `get_or_create()` (fully idempotent) to insert the same one demo user + 3 locations + 6 slots, going through the Django ORM (so it also respects `ParkingSlot.floor` and model-level defaults). Uses the same `'accessible'` slot type as `database/seed.sql`.

**Recommendation for anyone continuing this project:** consolidate to a single seed source of truth (most likely the Django management command, since it's idempotent and ORM-validated) and delete or clearly mark the other two as historical/reference-only.

## 7. Stale/backup artifacts (not part of the live schema)

These files exist in the repo root, apparently produced while migrating from local SQLite to Neon Postgres. They are **snapshots, not schema definitions** — do not treat them as authoritative:

- `db.sqlite3.safe-backup`
- `db_sqlite_before_neon.sqlite3`
- `sqlite_api_data.json`
- `sqlite_api_data_utf8.json`
- `sqlite_backup.json`
- `inspect-schema-temp.mjs`, `check-vehicles.cjs` — one-off Node scripts, apparently used to inspect/verify the schema and vehicle data during the migration; not part of the running application.

## 8. Naming inconsistencies to resolve

| Concept | Name in `schema.sql` / Django | Name in live Neon SQL (`src/db/neon.ts`) |
|---|---|---|
| Pricing table | `pricing_rules` | `parking_pricing` |
| Third slot type | `disabled` (schema.sql) | `accessible` (seed.sql, Django seed command, ER diagram, `types.ts` uses `disabled`) |

Before writing new queries or migrations, **verify against the actual live Neon database** (e.g. via `inspectParkingTables()` / `testDatabaseTables()`, both already wired into `server.ts`'s startup logs) rather than assuming `schema.sql` is 100% in sync with production.

## 9. Security notes specific to the data layer

- Passwords are stored as **plain text** in every seed path reviewed (`schema.sql`, `database/seed.sql`, `api/management/commands/seed.py`, and the in-memory `store.ts`). There is no hashing (e.g. bcrypt/argon2) anywhere in the reviewed code. This must be fixed before handling real user credentials.
- `.env`, `django.env`, and `django.env.backup` were **not opened or reproduced** in this documentation pass — they likely contain the real `DATABASE_URL` (including Neon credentials) and `SECRET_KEY`. Rotate any credentials before making this repository non-private, and add these files to `.gitignore` if not already excluded.

# ParkBy — Database Context

ParkBy deliberately splits its data across **three stores with different jobs**, rather than putting everything in one relational database:

| Store | Holds | Why |
|---|---|---|
| **PostgreSQL** (Neon/Supabase in prod, SQLite fallback locally) | Users, locations, zones, slots, bookings — durable system-of-record data | Needs transactions, relations, and migrations |
| **MongoDB Atlas** | The single latest occupancy document per parking location | Rewritten every ~2 seconds by edge cameras; a poor fit for a migrated relational schema |
| **Redis** | The Django Channels pub/sub layer (`parking_live` group) | In-memory broadcast, not durable storage |

## 1. Engine & hosting

- **Relational:** PostgreSQL in production, accessed via Django's ORM and `dj-database-url` parsing of `DATABASE_URL`. Falls back automatically to local SQLite (`db.sqlite3`) when `DATABASE_URL` is unset — **never rely on SQLite in the Vercel deployment**, since local files are ephemeral there.
- **Real-time document store:** MongoDB Atlas, one collection per location, named `parking_db.parking_status_<location_key>` (see §3 for the slug format). Each collection effectively holds one continuously-upserted "current state" document per site.
- **Channel layer:** Redis, used exclusively to fan out WebSocket broadcasts through Django Channels — it is not used as a general application cache.
- **Migration tooling:** Django migrations (`api`/app-level `migrations/` folders) are the authoritative way to evolve the relational schema; there is no separate raw-SQL schema file in this stack (unlike a hand-rolled `schema.sql` approach).

## 2. Relational schema (Django ORM models)

### `accounts.User`
Extends `AbstractBaseUser` + `PermissionsMixin` with custom fields:

| Field | Type | Notes |
|---|---|---|
| id | UUIDField (PK) | |
| phone_number | CharField, unique | Primary login identity |
| email | EmailField, unique | Optional |
| name | CharField | |
| user_code | CharField, unique | Auto-generated: `phone_number_name` |
| is_organization | BooleanField | Default `False` |
| organization_name | CharField | Nullable |
| is_verified | BooleanField | Default `False` |
| role | property | Derived `"admin"` / `"owner"` / `"user"` from flags, not a stored column |
| has_approved_parking | property | Checks whether the user owns an approved parking location |

### `parking.ParkingLocation`
A parking lot listed by an owner:

| Field | Type | Notes |
|---|---|---|
| id | UUIDField (PK) | |
| owner | FK → User | |
| name / address / city / state / pincode | text fields | |
| custom_id | CharField, unique | Auto-generated: `STATE_CITY_PINCODE_PARKINGNAME` |
| location_key | SlugField, unique | Maps to the MongoDB status collection |
| mongo_uri | CharField | Optional — lets a site use a private/custom Mongo cluster |
| latitude / longitude | DecimalField | |
| parking_type | JSONField | e.g. `['open', 'covered']` |
| parking_category | CharField | `commercial` / `public` / `private` / `non_commercial` |
| two_wheeler_hourly_rate / four_wheeler_hourly_rate | DecimalField | |
| total_two_wheeler_slots / total_four_wheeler_slots | PositiveIntegerField | |
| layout_data | JSONField | Rows/cols grid matrix layout, consumed by the BFS allocator |
| campus_map_data | JSONField | GeoJSON-style boundaries, navigation routes, and gates |
| status | CharField | `pending` / `approved` / `rejected` |

### `parking.ParkingZone`
Splits a large location into sub-areas:

| Field | Type | Notes |
|---|---|---|
| id | UUIDField (PK) | |
| parking | FK → ParkingLocation | |
| name / color | | |
| boundary | JSONField | Polygon vertex coordinates |
| car_slots / bike_slots | PositiveIntegerField | |
| custom_id | CharField, unique | Auto-generated: `PARENT_CUSTOM_ID_ZONENAME` |

### `parking.ParkingSlot`

| Field | Type | Notes |
|---|---|---|
| id | UUIDField (PK) | |
| parking | FK → ParkingLocation | |
| zone | FK → ParkingZone, nullable | |
| slot_number | CharField | |
| slot_type | CharField | `two_wheeler` / `four_wheeler` |
| status | CharField | `available` / `booked` / `occupied` |
| is_active | BooleanField | Default `True` |
| custom_id | CharField, unique | Auto-generated: `ZONE_CUSTOM_ID_SLOTNUMBER` |

### `bookings.Booking`

| Field | Type | Notes |
|---|---|---|
| id | UUIDField (PK) | |
| booking_id | CharField, unique | Auto-generated: `BK-YYYYMMDD-HEX6` |
| user / parking / slot / preferred_slot | FKs | |
| vehicle_type / vehicle_number / vehicle_model | | |
| start_time / end_time | DateTime | Requested window |
| entry_time / exit_time | DateTime, nullable | Populated on start/stop |
| hourly_rate / estimated_hours / estimated_amount | | Computed at booking time |
| platform_fee / is_platform_fee_paid | | |
| final_amount | DecimalField, nullable | Populated on exit |
| status | CharField | `payment_pending` / `confirmed` / `waiting` / `active` / `completed` / `cancelled` / `released` |

> Vehicles are represented inline on `Booking` (`vehicle_type`/`vehicle_number`/`vehicle_model`) rather than via a separate `Vehicle` model with a foreign key from bookings — the frontend's `AuthContext` does expose `addVehicle()`/`updateVehicle()`/`deleteVehicle()` actions, so a dedicated vehicle-profile model likely exists per user even though it isn't detailed in the reviewed backend docs. **Verify against `apps.accounts` models before assuming this list is exhaustive.**

## 3. Real-time document store (MongoDB)

- **Collection naming:** `parking_db.parking_status_<location_key>`, produced by `parking_status_collection_name()` — lower-cases the key and replaces non-alphanumeric characters with `_`.
- **One document per location**, continuously **upserted** (not appended) by `save_to_mongo.py` roughly every 2 seconds, keyed on the `location` field.
- **Document shape:**
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
      {
        "name": "EN Teachers' Parking",
        "capacity": 30,
        "vehicles": 12,
        "available": 18,
        "status": "open",
        "emergency_closed": false
      }
    ]
  }
  ```
- **`display_name` is authoritative from Postgres, not Mongo:** both the watcher thread and the `/api/all-parking/` endpoint override the raw `display_name` written by the edge server with `ParkingLocation.name` from PostgreSQL, so a site's official registered name always wins over whatever local label the edge config uses.
- **Staleness signaling:** documents can carry `no_cluster`, `no_data`, or `stale` flags (set when the edge server stops sending); the frontend's Zustand store treats these as "mark this location offline, zero out capacity."
- **Date handling:** `fetched_at` may arrive as a MongoDB extended-JSON `{"$date": ...}` wrapper; `mongo_document_to_jsonable()` unpacks this before the document reaches the API response or the WebSocket broadcast.

## 4. Redis (Channels layer)

- Backs Django Channels' channel layer only — WebSocket clients connected to `/ws/parking/` are added to a single broadcast group, `parking_live`.
- Not used as a general query cache; the 5-minute client-side cache for `/parking/locations/` lives in the **frontend's** local storage (`useParkingStore`), not in Redis.

## 5. Entity relationships (relational side)

```
User (1) ──owns──< ParkingLocation
ParkingLocation (1) ──< ParkingZone
ParkingLocation (1) ──< ParkingSlot
ParkingZone (1) ──< ParkingSlot            (zone is nullable on ParkingSlot)
User (1) ──< Booking >── (1) ParkingLocation
ParkingSlot (1) ──< Booking (via slot / preferred_slot)
```

The MongoDB occupancy documents and the relational schema are linked only loosely — by the shared `location_key` string, not a foreign key — since they live in different databases entirely. Any join between "how many spots are free right now" (Mongo) and "which spots are actually bookable" (Postgres) happens in application code (the watcher thread and the BFS allocator), not at the database layer.

## 6. Data-loading / seeding

Seed data is created through Django's standard tooling (fixtures / management commands) rather than a hand-maintained raw-SQL seed file. No dedicated seed command was found documented in the reviewed materials — **confirm with the team whether a `manage.py seed`-style command exists**, since the earlier/simpler snapshot of this project (see `README__2_.md`) did rely on hardcoded demo data, and that pattern may or may not still apply here.

## 7. Security notes specific to the data layer

- Authentication does **not** store or compare plaintext passwords for end users — login is OTP-based (phone/email) or Google OAuth, with SimpleJWT issuing access/refresh tokens. Admin login (`/accounts/admin/login/`) does use an email/password pair; confirm this is hashed via Django's standard password hasher rather than compared in plaintext.
- `campus_map_data` and `layout_data` are trusted, owner-submitted JSON blobs consumed directly by the frontend's map/grid renderers and by the backend's BFS allocator — validate shape/bounds server-side before trusting owner-submitted layouts in pathfinding, since a malformed grid could break slot assignment for an entire location.
- `mongo_uri` on `ParkingLocation` allows a location to point at a **custom, owner-specified MongoDB cluster**. This is a meaningful trust boundary: any code path that connects to a location's `mongo_uri` should be treated as connecting to an untrusted third-party endpoint (validate/sanitize the URI, avoid ever executing owner-supplied query logic against it).
- `.env` files (Django `django.env`, edge server `.env`) are known to contain real `DATABASE_URL`, `MONGO_URI`, and gateway/API credentials — rotate any exposed values and confirm these files are `.gitignore`d before making the repository non-private.

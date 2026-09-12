# ParkBy — Frontend Context

## 1. Stack

| Concern | Tool / Library |
|---|---|
| Framework | React + TypeScript |
| Build tool / dev server | Vite |
| Routing | react-router-dom (real routes, not a single `activeTab` state) |
| Styling | Tailwind CSS |
| Component library | Shadcn UI (`components/ui/`) |
| Global session state | React Context API |
| Cached / high-frequency state | Zustand (`useParkingStore`) |
| Maps | Mapbox GL JS + a custom Mapbox Draw rectangle mode |
| Animation | Framer Motion |
| 3D / landing page hero | Spline |
| HTTP client | Axios (with a JWT interceptor) |
| Optional CDN/storage | Supabase client (`integrations/supabase/client.ts`) |

## 2. Directory structure

```
parkby_frontend/
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── index.html
└── src/
    ├── App.tsx               # Root: state providers + routing
    ├── main.tsx              # React DOM render entry
    ├── index.css             # Tailwind entry, fonts, scrollbars
    ├── types/                # Shared TS interfaces (index.ts, google.d.ts)
    ├── store/                # Zustand global parking cache (useParkingStore.ts)
    ├── utils/                # Canvas/geometry/coordinate transforms (drawRectangle.ts)
    ├── hooks/                # useParkingLive.tsx, useParkingWebSocket.ts
    ├── integrations/         # supabase/client.ts
    ├── contexts/             # AuthContext, BookingContext, NotificationContext, ThemeContext
    ├── pages/                # One component per route
    └── components/
        ├── ui/               # Shadcn primitives (accordion, dialog, sidebar, select, ...)
        └── dashboard/        # OccupancyChart, RevenueChart, and other dashboard widgets
```

## 3. Pages & routes

| Route | Component | Purpose |
|---|---|---|
| `/` | `LandingPage.tsx` | Dark-mode landing page: 3D hero (Spline), value-prop stats, animated testimonials, CTA into customer/owner onboarding |
| `/live-status` | `LiveStatus.tsx` | Public real-time occupancy view: connects to the WebSocket/poll feed, shows capacity meters, connection-status indicator, per-zone grid summaries |
| `/search` | `HomePage` / `Index.tsx` | Core map-based discovery page: Mapbox clusters, sidebar filters, price sorting, GPS/search-based nearby lookup |
| `/customer-dashboard` | `CustomerDashboard.tsx` | Manage vehicles, active/past bookings, invoices, live navigation to an assigned slot, buffer-extension requests, session ratings |
| `/owner-dashboard` | `OwnerDashboard.tsx` | Listing creation wizard, document uploads, live zone analytics, dynamic pricing editor, booking history, manual slot overrides |
| `/admin-login`, `/admin-dashboard` | `AdminLogin.tsx`, `AdminDashboard.tsx` | Review pending listings, inspect uploaded ownership documents, approve/reject locations, system-wide booking register |
| `/about-us` | `AboutUs.tsx` | Company info page (mission, offerings, HQ contact) — replaces the legacy "Pro Plan" nav item everywhere |

## 4. High-complexity interactive components

### `MapboxRouteNavigator.tsx`
Indoor/outdoor **hybrid navigation**: visualizes parking areas, internal corridors, gates, and landmarks; clicking an area/landmark triggers combined routing from the user's current GPS location to the campus entrance gate (public directions), chain-welded to the internal road network. Renders theme-aware styling (e.g. light-mode sky-blue roads `#0ea5e9`/`#1e3a8a`, low-opacity slate parking zones, pink landmark markers `#ec4899`), with zoom-dependent label reveal (labels hidden until zoom ≥ 16.5, then shown in a high-contrast dark popup). Displays combined step-by-step instructions, total distance, and ETA including campus walking time.

### `MapArchitect.tsx`
The **campus mapping utility for owners**: draws boundaries for parking spots, pathways, gates, and buildings; full CRUD for zone entry points (create, drag-to-relocate, replace, delete) and custom landmark pointers (place on click, choose an icon/emoji, name/describe, drag, delete). Uses a customized Mapbox Draw engine. Outputs structured map JSON (areas, routes, gates, landmarks) into the location's `campus_map_data` field.

### `GridLayoutEditor.tsx` & `ParkingSpaceMapEditor.tsx`
The **grid layout builder**: renders a matrix representing the lot; places roads, boundary cells, entryways, exits, and slots; handles bulk slot creation, auto-labeling, and type allocation (two-wheeler vs. four-wheeler); enforces a reachability rule (every slot must be adjacent to a road cell) before submitting the layout JSON.

### `BookingModal.tsx`
The customer reservation flow: vehicle selection, time schedule, a visual real-time slot-availability selector, and a simulated platform-fee confirmation step before the booking is actually created.

### `ParkingLiveStatusCards.tsx`
Real-time status cards on the landing page. Supports an `onSelect` callback with hover/focus scale + color-border transitions; clicking a card maps its `location_key` back to the matching `ParkingSpace` in `BookingContext` and opens the same details/availability modal used in the Discover section (no duplicate modal implementation). Dynamically resolves button label/color from `ParkingLocationLite`: **VIEW** (blue) for non-commercial/public/free locations (`parking_category === 'public' || 'non_commercial' || (rate_2w === 0 && rate_4w === 0)`), **BOOK** (green) for standard paid commercial sites.

## 5. State management architecture

```
React App
├── ThemeProvider         --> dark/light theme classes
├── AuthProvider          --> JWT tokens, profile, vehicle list
├── ParkingLiveProvider   --> establishes the WebSocket connection
├── NotificationProvider  --> fetches/stores notification count & logs
└── BookingProvider       --> spaces list, bookings list, session state
```

### `AuthContext.tsx`
- **JWT interceptor** — injects `access_token` as a Bearer header on every Axios request.
- **Automatic 401 retry** — on a `401`, pauses the request queue, calls `/token/refresh/` with the stored `refresh_token`, updates `localStorage`, and retries; on refresh failure, clears storage and redirects to the landing page.
- Exposes `sendOtp()`, `verifyOtp()`, `loginWithGoogle()`, `updateProfile()`, `addVehicle()`, `updateVehicle()`, `deleteVehicle()`.

### `BookingContext.tsx`
- **Real-time store sync** — subscribes directly to the Zustand store's `locations` state; live updates merge straight into `parkingSpaces` without an extra API round-trip, so Discover/Nearby/Map views stay current.
- **Visible-tab poller** — refreshes `/parking/locations/` metadata every 45s, but suspends while `document.visibilityState !== 'visible'`.
- **Live slot mapper** — distributes live zone occupancy counts proportionally onto individual slot components in the grid.
- **Session handlers** — `startParking()` (simulated gate entry), `stopParking()` (duration calc + simulated ANPR trigger), `completePayment()`, `extendBooking()`.
- **Timer expirations** — warns at <10 minutes remaining on an active session; triggers auto-release on expiry.

### `useParkingStore.ts` (Zustand)
- **Cache validation** — caches the `/parking/locations/` payload in local storage for 5 minutes.
- **WebSocket merge** — on a `parking_update` event: matches `location_key`, normalizes zone tags, and either zeroes out capacity + marks a site offline (if flagged `no_cluster`/`no_data`/`stale`) or maps the incoming metrics onto the matching location's nested zones.
- **Fallback poller** — polls the lightweight all-locations endpoint every 30s when the WebSocket is disconnected.

## 6. Integration libraries & utilities

- **`drawRectangle.ts`** — a custom Mapbox Draw mode: click-drag to define a rectangle rather than plotting every corner. Provides `onSetup`/`onClick`/`onMouseMove` handlers plus geometry transforms: `scalePolygon`, `flipHorizontal`/`flipVertical`, `rotatePolygon`.
- **`parkingMapConfig.ts`** — matches drawn zone shapes to live IoT groups via `tokenOverlapScore()` (token-overlap similarity between zone name strings) and `matchGroupToZone()` (applies a `0.3` overlap threshold to bind live metrics to the correct visual zone).
- **`integrations/supabase/client.ts`** — connection details for optional CDN storage (verification documents, receipts).

## 7. Edge server integration (frontend perspective)

The frontend never talks to the edge scripts directly — everything arrives via the Django WebSocket or its REST fallback.

```
Edge Server (p.py + save_to_mongo.py)
    │  MongoDB Atlas upsert (~every 2s)
    ▼
Django Watcher → Redis → Daphne
    │  WebSocket broadcast: ws://host/ws/parking/
    ▼
ParkingLiveProvider (React context)
    │  raw JSON → useParkingStore
    ▼
Zustand Store: merge/normalize per location_key
    ├──► LiveStatus.tsx     — capacity meters, zone bars
    ├──► HomePage/Index.tsx — Mapbox cluster badge counts
    └──► OwnerDashboard.tsx — live zone analytics charts
```

| Hook | Responsibility |
|---|---|
| `useParkingWebSocket.ts` | Connects the WebSocket; dispatches raw JSON events to the store |
| `useParkingLive.tsx` | Higher-level: reconnect logic, heartbeat pings, connection-status state |

**Fallback polling:** when disconnected, the store falls back to polling `GET /api/all-parking/` every 30 seconds.

**Connection status shown in `LiveStatus.tsx`:**
- 🟢 Connected — WebSocket active, live edge data
- 🟡 Polling — WebSocket down, 30s REST fallback active
- 🔴 Offline — both failed; last known data shown with a stale warning

**ANPR (future/indirect):** `a.py`'s plate-read data lives only in its local SQLite database today. The frontend doesn't consume it yet, but `BookingContext.stopParking()` already contains a simulated ANPR trigger hook intended to be wired to real `a.py` reads (e.g. via a Django proxy to `/api/anpr/recent`) in a future version.

## 8. Vercel frontend deployment

- **Framework preset:** React / Vite. **Build command:** `npm run build`. **Output directory:** `dist`.
- Deployed either standalone or as part of a **unified monorepo `vercel.json`**, serving the built frontend and routing `/api/v1/` to the Django `vercel_app.py` function.
- **Env vars (with dynamic fallbacks if unset):** `VITE_API_BASE_URL` (falls back to relative `/api/v1` in production, `http://127.0.0.1:8000/api/v1` locally), `VITE_API_URL` (falls back to the current browser origin for WebSocket resolution), `VITE_GOOGLE_CLIENT_ID`, `VITE_SUPABASE_PROJECT_ID`/`VITE_SUPABASE_PUBLISHABLE_KEY`/`VITE_SUPABASE_URL`.
- **OAuth:** `https://testparkby.vercel.app` must be an Authorized JavaScript Origin *and* an Authorized Redirect URI in Google Cloud Console.
- **Client-side routing / SPA fallback:** because routing is client-side (`react-router-dom`), Vercel must rewrite all non-asset, non-API paths to `index.html`, or direct navigation to e.g. `/customer-dashboard` will 404.
- **Serverless fallback behavior:** `useParkingLive` catches socket disconnects and falls back to polling `/api/all-parking/` every 30s; that endpoint resolves data directly from MongoDB Atlas on the Django side, so the dashboard stays functional without Daphne/ASGI.

## 9. Things a frontend engineer should know before making changes

1. Routing is real (`react-router-dom`) — add a new page as a route + component, not a new `activeTab` branch.
2. Live parking data has two independent paths into the UI — the WebSocket (via `ParkingLiveProvider`/Zustand) and 45s/30s REST polling inside `BookingContext`/`useParkingStore`. Be clear about which one a given component actually reads from before "fixing" a staleness bug.
3. `BookingContext`'s zone-to-slot occupancy mapping is proportional/approximate (it distributes a zone-level available count across slot components), not a guaranteed 1:1 live status per physical slot — don't treat individual slot "available" flags as camera-ground-truth without checking the mapping logic.
4. The VIEW-vs-BOOK button logic on live status cards is a **client-side rule** based on `parking_category` and rate fields — if this distinction ever needs to be authoritative/tamper-proof, it should move server-side.
5. Zone-name matching between the map editor and live camera groups is fuzzy (`tokenOverlapScore`, threshold `0.3`) — renaming a zone in the editor without a matching rename on the edge side can silently break live-data binding for that zone.

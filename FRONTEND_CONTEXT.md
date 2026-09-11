# ParkBy — Frontend Context

## 1. Stack

| Concern | Tool / Library | Version (per `package.json`) |
|---|---|---|
| Framework | React | ^19.2.8 |
| Language | TypeScript | ~5.8.2 |
| Build tool / dev server | Vite | ^6.2.3 |
| React plugin for Vite | @vitejs/plugin-react | ^5.0.4 |
| Styling | Tailwind CSS | ^4.1.14 (via `@tailwindcss/vite` plugin) |
| CSS autoprefixing | autoprefixer | ^10.4.21 |
| Icons | lucide-react | ^0.546.0 |
| Animation | motion (Framer Motion successor) | ^12.23.24 |
| AI SDK (used from the Express server, not the browser bundle) | @google/genai | ^2.4.0 |
| Type checking | `tsc --noEmit` (`npm run lint`) | — |

There is **no client-side router** (no react-router) — navigation is done via a single `activeTab` state string switched inside `App.tsx`. There is **no external state manager** — all state lives in local `useState` hooks in `App.tsx` and is threaded down via props.

## 2. Entry points & structure

```
index.html          # Vite HTML entry
src/main.tsx          # ReactDOM root render
src/App.tsx            # Top-level component: owns almost all app state
src/apiConfig.ts        # API_BASE_URL constant
src/types.ts             # Shared TS interfaces/types for the whole frontend
src/index.css              # Tailwind entry / global styles
src/components/
  Navbar.tsx                # Top nav, tab switching, auth trigger
  HeroSection.tsx             # Landing/hero content for the "about"/home tab
  ParkingFinder.tsx             # Browse locations & slots, initiate booking
  QuickBookModal.tsx              # Modal to confirm a booking (vehicle no., duration)
  ActiveBookings.tsx                # List of the user's current/past bookings; extend/cancel actions
  AuthModal.tsx                       # Sign up / log in / Google-style auth modal
  ProfileModal.tsx                       # View/edit user profile & wallet
  NotificationsModal.tsx                    # Notifications panel
  AddLocationSlotModal.tsx                    # Admin-only: add a new location or slot
  ChatWidget.tsx                                # Floating AI chat assistant widget
  Footer.tsx                                      # Footer content
```

## 3. State & data flow (`App.tsx`)

Key pieces of top-level state:
- `activeTab` — controls which "page" is shown (about/home, finder, bookings, etc.).
- `locations: ParkingLocation[]`, `slots: ParkingSlot[]`, `bookings: Booking[]` — fetched from the backend and passed down to child components.
- `currentUser: UserAccount | null` — initialized from `localStorage.getItem('parkby_user')` if present, else falls back to a hardcoded demo admin user object (matching the seeded demo user in the database) so the UI has something to show before real auth completes.

On mount, `App.tsx` fetches in parallel:
```
GET /api/locations
GET /api/slots
GET /api/bookings/my?user_id=<currentUser.id>
```
and stores the results in state. All three endpoints are called relative to `API_BASE_URL` (empty string by default, meaning same-origin as the page — this matters because the Express server serves the frontend AND the API on the same port).

### User-triggered network calls (by component)

| Component | Endpoint(s) called | Purpose |
|---|---|---|
| `App.tsx` | `POST /api/auth/logout` | Sign the user out |
| `App.tsx` | `POST /api/bookings` | Create a new booking (Pay & Park step 1) |
| `App.tsx` | `POST /api/payments` (inferred from flow, see two more `fetch` calls around booking confirmation) | Confirm mock payment, activate the booking |
| `AuthModal.tsx` | `POST /api/auth/google`, and one of `/api/auth/signup` \| `/api/auth/login` (dynamic `endpoint` variable) | Authentication |
| `AddLocationSlotModal.tsx` | `POST /api/locations/`, `POST /api/slots/` | Admin: create new parking location / slot |
| `ChatWidget.tsx` | `POST /chat` | Send a user chat message, receive the assistant's reply + structured `data` (slots, booking result, etc.) |

### Persistence on the client

- `localStorage['parkby_user']` — the only client-side persistence. There are no auth tokens/cookies; "being logged in" is purely "this JSON blob exists in localStorage." This is fine for a prototype but is **not secure session management**.

## 4. Shared domain types (`src/types.ts`)

These TypeScript interfaces are the contract the whole frontend codes against, and should stay in sync with whichever backend (Express/Neon or Django) is live:

- `UserAccount`, `UserRole` (`'user' | 'admin'`)
- `ParkingLocation`
- `ParkingSlot`, `SlotType` (`'regular' | 'ev' | 'disabled'`), `SlotStatus` (`'available' | 'occupied' | 'maintenance'`)
- `Vehicle`, `VehicleType` (`'car' | 'bike' | 'ev' | 'suv'`)
- `PricingRule`
- `Booking`, `BookingStatus` (`'pending' | 'active' | 'completed' | 'cancelled' | 'expired'`)
- `PaymentRecord`
- `ChatMessage`, `ChatConversation`, `ChatRequest`, `ChatResponse`

⚠️ Note the small type/schema drift: `types.ts` defines `SlotType` as `'regular' | 'ev' | 'disabled'`, while the Django seed data and `ER_DIAGRAM.md` use `'accessible'` instead of `'disabled'` for the same concept. Reconcile this before doing type-safe end-to-end work across both backends.

## 5. Styling & design system

- Tailwind CSS v4, wired in via the official Vite plugin (`@tailwindcss/vite`) rather than a PostCSS config file — utility classes are used directly in JSX.
- `lucide-react` supplies all iconography (e.g. `MessageSquare`, `Sparkles` seen in `App.tsx`).
- `motion` (the renamed/evolved Framer Motion package) is available for transitions/animations in components like modals.
- No component library (no shadcn/ui, MUI, etc.) — components are hand-built.

## 6. Build & dev workflow

```bash
npm install
npm run dev     # runs `tsx server.ts` — Vite runs in middleware mode INSIDE the Express server
                 # frontend + API both served from http://localhost:3000

npm run build    # `vite build` (bundles the frontend to dist/) then
                  # esbuild bundles server.ts -> dist/server.cjs (CJS, Node platform)
npm run start      # `node dist/server.cjs` — production server serving the built SPA + API
npm run clean       # rm -rf dist
npm run lint         # tsc --noEmit (type-check only, no separate linter like ESLint configured)
```

Note: because `npm run dev` boots Vite in **middleware mode** from inside `server.ts`, the frontend dev server and the API are always the same origin/port (3000) in this workflow — this is different from the alternative Django-oriented dev flow implied by `vite.config.ts`'s `/api → 127.0.0.1:8000` proxy, which would only take effect if Vite were run standalone (`vite dev`) rather than through `tsx server.ts`. See `PROJECT_CONTEXT_TECHNICAL.md` §1 for the dual-backend caveat.

## 7. Things a frontend engineer should know before making changes

1. There is no router — adding a new "page" means adding another `activeTab` value and a conditional render block in `App.tsx`, not a new route file.
2. All API paths are relative and same-origin by default; don't hardcode `http://localhost:3000` in components — use `API_BASE_URL` from `apiConfig.ts`.
3. `currentUser` can be `null` transiently but `App.tsx`'s default fallback silently substitutes a hardcoded demo admin user rather than truly being logged out — be careful not to assume `currentUser === null` means "logged out" in every code path.
4. The chat widget's replies and the "Book slot A2"-style natural-language booking flow are driven entirely by the backend (`/chat`); the frontend just renders whatever `reply`/`data` the server returns — there's no NLU logic on the client.
5. Confirm which backend (Express/Neon vs Django) is running before debugging a "missing field" issue — the two backends' JSON response shapes are similar but not guaranteed identical (e.g., Django wraps in DRF serializer output while Express hand-builds JSON).

# ParkBy — Project Overview (Non-Technical)

## What is ParkBy?

ParkBy is a **smart parking reservation app**. It lets a driver open a website, see which parking spots are free right now at nearby locations, and book one in advance — like booking a movie seat, but for a parking space.

Think of it as **"OYO / Zomato, but for parking spots."**

## Who is it for?

- **Drivers / end users** — people who want to find and reserve a parking spot ahead of time instead of driving around looking for one.
- **Parking facility operators / admins** — the people who own or manage a mall, office park, or building parking lot and want to list their spots, set prices, and track occupancy.

## What can someone do in the app?

1. **Sign up / log in** — with an email + password, or a one-click "Continue with Google" style login.
2. **Get a welcome bonus** — every new user starts with a ₹500 wallet credit.
3. **Browse parking locations** — see a list of parking facilities (e.g. "Central Mall Underground", "Cyber Hub Parking Lot B"), each with an address, opening hours, and how many slots are free.
4. **See live slot availability** — each location has individual numbered slots (like A-01, B-02), color-coded by type:
   - **Regular** parking
   - **EV** (electric vehicle charging-enabled) parking
   - **Accessible** parking
   and by status: available, occupied, or under maintenance.
5. **Book a slot** — pick a slot, enter a vehicle number and how many hours they need it, and reserve it.
6. **Pay** — a simple mock "Pay & Park" payment step (UPI / card / cash placeholder) confirms the booking and marks the slot as taken.
7. **Manage active bookings** — see the countdown/timer on a current booking, **extend** it by another hour, or **cancel** it (which frees the slot back up).
8. **Chat with an AI parking assistant** — a chat widget answers plain-English questions like "any spots free near Gate 1?", "how much does it cost?", or "book slot A2", and can even make the booking for you conversationally.
9. **Admin tools** — an admin user can add brand-new parking locations and add slots to existing ones.

## Why this matters (the business idea)

- Parking is a hassle: circling a block looking for a spot wastes time, fuel, and causes congestion.
- ParkBy pre-reserves a guaranteed spot, so drivers know exactly where they're going and don't waste time searching.
- Facility owners get better utilization of their parking capacity and a digital record of every booking and payment.
- The AI assistant makes the whole experience feel like texting a helpful attendant instead of navigating menus.

## How the pieces fit together (plain-English version)

- There's a **website** the user sees and clicks around in (the "front of house").
- Behind it, there's a **server** that keeps track of everything — who's logged in, which slots are free, which bookings are active (the "back office").
- All of that information is permanently stored in a **database** — a structured filing system of users, locations, slots, bookings, and payments — so nothing is lost when the app restarts.
- A **third-party AI model (Google Gemini)** powers the natural-language chat assistant, falling back to simple canned responses if the AI service isn't reachable.

## Current project status

This is a **working demo / prototype**, not yet a hardened production system:
- Payments are simulated (they always "succeed") rather than connected to a real payment gateway.
- There's a simplified login flow rather than full secure session/authentication infrastructure.
- The project currently contains **two parallel backend implementations** (a Node.js one and a Python/Django one) built while exploring different technology directions — see the technical documentation for details on which one the live app actually uses today.

## Related documents

- `PROJECT_CONTEXT_TECHNICAL.md` — full technical architecture
- `FRONTEND_CONTEXT.md` — the website/UI layer
- `BACKEND_CONTEXT.md` — the server layer(s) and APIs
- `DATABASE_CONTEXT.md` — data model, schema, and pipelines

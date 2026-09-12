# ParkBy — Project Overview (Non-Technical)

## What is ParkBy?

ParkBy is an **AI-powered smart parking and urban mobility platform**. It turns ordinary parking lots — malls, IT parks, hospitals, universities, residential societies — into digitally discoverable, instantly bookable, and automatically monitored parking assets.

Think of it as **"a control tower for parking"**: cameras already installed at a site are used to see which spots are free in real time, and that live information flows straight into a booking app a driver can use from their phone.

## Who is it for?

- **Drivers / end users** — people who want to find a guaranteed parking spot in advance instead of circling a block.
- **Parking owners / operators** — malls, IT parks, hospitals, universities, and residential societies that want to list their space, automate entry/exit, and earn revenue from spots that are otherwise sitting idle.
- **Institutions & businesses** — organizations that want centralized control over their parking infrastructure, automated vehicle entry/exit, and better security.
- **Governments & smart cities** — municipal bodies and smart-city projects that want mobility analytics and better parking utilization across a city.

## What can someone do in the app?

1. **Sign up / log in** — via phone number + OTP (email or SMS), or one-tap Google login.
2. **Discover nearby parking** — search or browse a live map (Mapbox) of approved parking locations, with price, distance, and real-time availability.
3. **See live occupancy** — a public "Live Status" view shows how full each site is right now, broken down by zone (e.g. "Teachers' Parking," "MBA Parking Area"), sourced directly from cameras at the site.
4. **Book a slot** — the system automatically assigns the *closest available slot to the entrance* (using a pathfinding algorithm over the lot's layout), rather than making the driver pick blind.
5. **Navigate all the way to the spot** — turn-by-turn directions combine public road navigation (Mapbox) with the site's own internal road network, gates, and landmarks, ending at the assigned slot.
6. **Start and stop a parking session** — simulated automatic gate entry, a live countdown timer, the ability to extend a session, and automatic billing when the session ends.
7. **Get recognized automatically at the gate** — cameras equipped with number-plate recognition (ANPR) can log vehicle entry/exit without a ticket or barcode.
8. **Pay digitally** — a platform fee plus the metered parking charge, via an integrated payment gateway (Razorpay).
9. **List a parking space as an owner** — upload site documents (e.g. electricity bill, ownership proof) for verification, draw the lot's layout and internal roads on a map editor, set pricing, and go live once approved.
10. **Manage the business as an owner** — see live zone-by-zone occupancy charts, revenue analytics, booking history, and manually override slot states if needed.
11. **Administer the platform** — review and approve/reject new parking listings, verify uploaded ownership documents, and oversee the full booking register across the platform.

## Why this matters (the business idea)

Searching for parking wastes driver time and fuel, and is a meaningful contributor to urban traffic congestion. It also leaves a lot of *existing* parking capacity — private lots, unused campus space — invisible and unmonetized.

ParkBy's approach is deliberately **sensor-light**: instead of asking every site to install expensive dedicated hardware, it uses computer vision (YOLO object detection) on cameras a site is likely to already have, to infer occupancy per slot. That live feed is what powers the booking guarantee, the live-status map, and the owner's analytics dashboard.

## How the pieces fit together (plain-English version)

- **At the parking site itself**, small edge-computer programs watch the camera feeds: one identifies which individual slots are occupied (computer vision), and another reads number plates as cars pass through the gate.
- Those programs constantly send a short "here's what's free right now" update up to the cloud.
- **In the cloud**, a central server keeps track of accounts, listings, bookings, and payments, and instantly pushes any change in occupancy out to every connected phone/browser — so the map and dashboards update live, without needing to refresh.
- **A website (and eventual mobile experience)** is what the driver, the owner, and the admin each see — with a different dashboard for each role.
- **A database** permanently stores everything durable (accounts, locations, bookings, payments); a separate fast, real-time data store is used just for the constantly-changing "is this slot free right now" signal, so the two concerns don't slow each other down.

## Current project status

This is an **active, in-development platform**, further along than a simple prototype but still evolving:
- The camera-based occupancy detection and number-plate recognition run as standalone programs at each site (an "edge server") and are not yet fully wired end-to-end into every dashboard — number-plate data, in particular, is logged today but not yet displayed anywhere in the customer or owner apps.
- Real-time updates rely on a persistent connection (WebSockets) which works well on a dedicated server, but the platform's cloud hosting (Vercel) does not support that kind of long-lived connection — so there's a built-in fallback that re-checks for updates every 30 seconds when a live connection isn't available.
- Owner onboarding (uploading documents to prove they legitimately operate a site) is verified using automated document scanning (OCR), with a human admin making the final approve/reject call.
- Payments run through a real gateway (Razorpay) rather than being simulated.

## Related documents

- `PROJECT_CONTEXT_TECHNICAL.md` — full technical architecture
- `FRONTEND_CONTEXT.md` — the website/UI layer
- `BACKEND_CONTEXT.md` — the cloud server, real-time layer, and the on-site edge programs
- `DATABASE_CONTEXT.md` — data model, schemas, and how the different data stores divide responsibilities

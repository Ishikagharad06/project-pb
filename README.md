# 🅿️ ParkBy - Smart Parking Management System

**ParkBy** is a full-stack, real-time parking spot reservation and facility management platform built with a **React 18 + TypeScript** frontend, a **Django REST Framework** Python backend, and an **SQL / Django ORM** database layer.

---

## 🏗️ Project Architecture Overview

```text
ParkBy Project
├── 🎨 FRONTEND (React 18 + Vite + Tailwind CSS)
│   ├── src/components/         # UI Modals, Parking Grid, Auth & Assistant
│   ├── src/db/store.ts         # Client API service & state manager
│   └── src/types.ts            # Shared TypeScript data models
│
├── 🐍 BACKEND (Django REST Framework + Python)
│   ├── backend/                # Settings, WSGI, URLs configuration
│   ├── api/                    # Django Models, Serializers & REST Views
│   ├── manage.py               # Django CLI management tool
│   ├── django.env              # Environment settings (Port, Secret Key)
│   └── requirements.txt        # Python package dependencies
│
└── 🗄️ DATABASE LAYER (SQL + Django ORM)
    ├── schema.sql              # Raw SQL table schemas, constraints & indexes
    ├── database/seed.sql       # SQL seed data script
    ├── database/ER_DIAGRAM.md  # Entity-Relationship Diagram (Mermaid)
    └── database/README.md      # Database architecture documentation
```

---

## 🚀 Quick Setup & Installation Guide

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** (for frontend development)

---

### Step 1: Backend Setup (Python / Django)

1. Open your terminal in the project directory:
   ```bash
   # Install dependencies
   pip install -r requirements.txt

   # Run database migrations
   python manage.py makemigrations
   python manage.py migrate

   # Seed initial demo data (Locations, Slots, Demo Admin Account)
   python manage.py seed

   # Start Django development server
   python manage.py runserver 8000
   ```
   *Backend API running at: `http://127.0.0.1:8000/api/`*

---

### Step 2: Frontend Setup (React / Vite)

1. Open a second terminal window in the project directory:
   ```bash
   # Install node dependencies
   npm install

   # Start Vite dev server
   npm run dev
   ```
   *Frontend web application running at: `http://localhost:3000/`*

---

## 🗄️ Database Management Commands

- **Seed Database**:
  ```bash
  python manage.py seed
  ```
- **Create Admin Superuser**:
  ```bash
  python manage.py createsuperuser
  ```
- **Import raw `schema.sql` into SQLite**:
  ```bash
  sqlite3 db.sqlite3 < schema.sql
  ```

---

## 🔑 Features

- **Google / Gmail Authentication**: 1-click login and ₹500 welcome bonus.
- **Interactive Parking Grid**: Live status tracking for Regular, EV, and Accessible slots.
- **Admin Management**: Dynamically add parking locations and slots.
- **Wallet & Bookings**: Instant booking, extensions, and wallet management.
- **AI Parking Assistant**: Real-time rate and availability responder.

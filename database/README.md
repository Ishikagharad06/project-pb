# 🗄️ ParkBy Database & Schema Documentation

Welcome to the **ParkBy** database documentation directory. This folder contains all schemas, seed data scripts, indexes, and ER diagrams for the project.

---

## 📂 Files Directory

| File | Description |
| :--- | :--- |
| **`schema.sql`** | Raw SQL schema file defining tables, constraints, foreign keys, and base indexes. |
| **`database/indexes.sql`** | Standalone SQL file containing all database performance indexes and compound query indexes. |
| **`database/seed.sql`** | SQL script inserting initial seed data (locations, slots, users, vehicles). |
| **`database/ER_DIAGRAM.md`** | Complete Mermaid ER Diagram showing relational entity maps and table fields. |
| **`api/models.py`** | Django ORM models matching the database schema. |

---

## 🚀 How to Initialize & Seed Database

### Option A: Using Django ORM (Recommended)

1. Apply Django migrations:
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

2. Seed demo data:
   ```bash
   python manage.py seed
   ```

---

### Option B: Using SQL File Directly (`schema.sql`)

- **PostgreSQL**:
  ```bash
  psql -U postgres -d parkby_db -f schema.sql
  ```
- **SQLite**:
  ```bash
  sqlite3 db.sqlite3 < schema.sql
  ```
- **MySQL**:
  ```bash
  mysql -u root -p parkby_db < schema.sql
  ```

---

## ⚡ Indexing Strategy

- **`parking_slots(parking_id)`**: Optimized for fetching all slots belonging to a location.
- **`parking_slots(status)`**: Fast lookup for EV, available, or occupied slots.
- **`bookings(user_id)`**: Quick retrieval of a user's active and historical reservations.
- **`users(email)`**: Unique index for instant user authentication lookups.

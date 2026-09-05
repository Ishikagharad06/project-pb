# 🗺️ ParkBy Database Entity-Relationship (ER) Diagram

This document contains the visual entity-relationship structure and table associations for the **ParkBy Smart Parking Management System**.

---

## 📊 Visual ER Diagram (Mermaid)

```mermaid
erDiagram
    USERS ||--o{ BOOKINGS : "places"
    USERS ||--o{ VEHICLES : "owns"
    PARKING_LOCATIONS ||--|{ PARKING_SLOTS : "contains"
    PARKING_LOCATIONS ||--o{ BOOKINGS : "hosts"
    PARKING_SLOTS ||--o{ BOOKINGS : "reserved_in"
    PARKING_LOCATIONS ||--o{ PRICING_RULES : "applies"

    USERS {
        string id PK
        string name
        string email UK
        string password
        string role "user | admin"
        string phone
        decimal wallet_balance
        string avatar_url
        string auth_provider "email | google"
        timestamp created_at
    }

    PARKING_LOCATIONS {
        string id PK
        string name
        string address
        string city
        float latitude
        float longitude
        int total_slots
        string opening_time
        string closing_time
        string status "active | inactive"
        timestamp created_at
    }

    PARKING_SLOTS {
        string id PK
        string parking_id FK
        string slot_number
        string slot_type "regular | ev | accessible"
        string status "available | occupied | maintenance"
        decimal price_per_hr
        string floor
    }

    VEHICLES {
        string id PK
        string user_id FK
        string registration_number UK
        string vehicle_type "car | bike | ev | suv"
        string model
        string color
    }

    BOOKINGS {
        string id PK
        string user_id FK
        string parking_id FK
        string slot_id FK
        string slot_number
        string vehicle_number
        timestamp start_time
        timestamp scheduled_end_time
        timestamp actual_end_time
        string status "active | completed | cancelled"
        decimal base_amount
        decimal extension_amount
        decimal total_amount
        timestamp created_at
    }

    PRICING_RULES {
        string id PK
        string parking_id FK
        string vehicle_type
        decimal hourly_rate
        decimal daily_rate
    }
```

---

## 🔑 Database Indexes & Constraints

To ensure sub-millisecond query performance, the following indexes are declared:

1. **`idx_slots_parking`**: Index on `parking_slots(parking_id)` for instantly loading facility slots.
2. **`idx_slots_status`**: Index on `parking_slots(status)` for filtering available vs occupied slots.
3. **`idx_bookings_user`**: Index on `bookings(user_id)` for retrieving user booking history.
4. **`idx_bookings_status`**: Index on `bookings(status)` for active reservation monitoring.

-- ============================================================
-- ParkBy Database Performance Indexes
-- Compatible with PostgreSQL, MySQL, and SQLite
-- ============================================================

-- ------------------------------------------------------------
-- 1. USERS INDEXES
-- ------------------------------------------------------------
-- Fast email lookup for login, Google OAuth, and auth checks
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Fast lookup by user role (user vs admin)
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);


-- ------------------------------------------------------------
-- 2. PARKING LOCATIONS INDEXES
-- ------------------------------------------------------------
-- Geospatial & city filtering for location searches
CREATE INDEX IF NOT EXISTS idx_locations_city ON parking_locations(city);

-- Compound index for finding active locations in a city
CREATE INDEX IF NOT EXISTS idx_locations_city_status ON parking_locations(city, status);


-- ------------------------------------------------------------
-- 3. PARKING SLOTS INDEXES
-- ------------------------------------------------------------
-- Foreign key lookup: Fetch all slots for a specific parking facility
CREATE INDEX IF NOT EXISTS idx_slots_parking ON parking_slots(parking_id);

-- Filter slots by status (available, occupied, maintenance)
CREATE INDEX IF NOT EXISTS idx_slots_status ON parking_slots(status);

-- Filter slots by type (regular, EV, disabled)
CREATE INDEX IF NOT EXISTS idx_slots_type ON parking_slots(slot_type);

-- Compound index: Fetch available EV or regular slots for a specific location instantly
CREATE INDEX IF NOT EXISTS idx_slots_parking_type_status ON parking_slots(parking_id, slot_type, status);


-- ------------------------------------------------------------
-- 4. BOOKINGS INDEXES
-- ------------------------------------------------------------
-- Fetch all bookings belonging to a specific user
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);

-- Filter bookings by status (active, completed, cancelled, expired)
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- Fetch bookings by parking location
CREATE INDEX IF NOT EXISTS idx_bookings_parking ON bookings(parking_id);

-- Compound index: Quick check for active user reservations with end time
CREATE INDEX IF NOT EXISTS idx_bookings_user_status ON bookings(user_id, status);

-- Time-range query index for active slot collision detection
CREATE INDEX IF NOT EXISTS idx_bookings_slot_time ON bookings(slot_id, start_time, scheduled_end_time);


-- ------------------------------------------------------------
-- 5. VEHICLES INDEXES
-- ------------------------------------------------------------
-- Unique vehicle registration plate lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_registration ON vehicles(registration_number);

-- User vehicle list lookup
CREATE INDEX IF NOT EXISTS idx_vehicles_user ON vehicles(user_id);


-- ------------------------------------------------------------
-- 6. CHAT MESSAGES INDEXES
-- ------------------------------------------------------------
-- Fast chat history retrieval by conversation ID
CREATE INDEX IF NOT EXISTS idx_chat_conversation ON chat_messages(conversation_id);

-- Ordering chat messages by timestamp
CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_messages(created_at);

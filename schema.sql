-- ============================================================
-- ParkBy Database Schema & Initial Seed Data
-- Standard SQL (Compatible with PostgreSQL, MySQL, SQLite)
-- ============================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    role VARCHAR(32) DEFAULT 'user', -- 'user' or 'admin'
    phone VARCHAR(32),
    wallet_balance DECIMAL(10, 2) DEFAULT 500.00,
    avatar_url TEXT,
    auth_provider VARCHAR(32) DEFAULT 'email', -- 'email' or 'google'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. PARKING LOCATIONS TABLE
CREATE TABLE IF NOT EXISTS parking_locations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(128) NOT NULL,
    latitude DECIMAL(10, 6) DEFAULT 28.4595,
    longitude DECIMAL(10, 6) DEFAULT 77.0266,
    total_slots INT NOT NULL DEFAULT 30,
    opening_time VARCHAR(32) DEFAULT '06:00',
    closing_time VARCHAR(32) DEFAULT '23:59',
    status VARCHAR(32) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. PARKING SLOTS TABLE
CREATE TABLE IF NOT EXISTS parking_slots (
    id VARCHAR(64) PRIMARY KEY,
    parking_id VARCHAR(64) NOT NULL,
    slot_number VARCHAR(32) NOT NULL,
    slot_type VARCHAR(32) DEFAULT 'regular', -- 'regular', 'ev', 'disabled'
    status VARCHAR(32) DEFAULT 'available',   -- 'available', 'occupied', 'maintenance'
    price_per_hr DECIMAL(8, 2) DEFAULT 20.00,
    FOREIGN KEY (parking_id) REFERENCES parking_locations(id) ON DELETE CASCADE
);

-- 4. VEHICLES TABLE
CREATE TABLE IF NOT EXISTS vehicles (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    registration_number VARCHAR(64) UNIQUE NOT NULL,
    vehicle_type VARCHAR(32) DEFAULT 'car', -- 'car', 'bike', 'ev', 'suv'
    model VARCHAR(128),
    color VARCHAR(64),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. PRICING RULES TABLE
CREATE TABLE IF NOT EXISTS pricing_rules (
    id VARCHAR(64) PRIMARY KEY,
    parking_id VARCHAR(64) NOT NULL,
    vehicle_type VARCHAR(32) NOT NULL,
    hourly_rate DECIMAL(8, 2) NOT NULL,
    daily_rate DECIMAL(8, 2) NOT NULL,
    FOREIGN KEY (parking_id) REFERENCES parking_locations(id) ON DELETE CASCADE
);

-- 6. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS bookings (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    parking_id VARCHAR(64) NOT NULL,
    parking_name VARCHAR(255) NOT NULL,
    slot_id VARCHAR(64) NOT NULL,
    slot_number VARCHAR(32) NOT NULL,
    vehicle_number VARCHAR(64) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    scheduled_end_time TIMESTAMP NOT NULL,
    actual_end_time TIMESTAMP,
    status VARCHAR(32) DEFAULT 'active', -- 'pending', 'active', 'completed', 'cancelled', 'expired'
    base_amount DECIMAL(10, 2) NOT NULL,
    extension_amount DECIMAL(10, 2) DEFAULT 0.00,
    total_amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parking_id) REFERENCES parking_locations(id) ON DELETE CASCADE,
    FOREIGN KEY (slot_id) REFERENCES parking_slots(id) ON DELETE CASCADE
);

-- 7. CHAT MESSAGES & LOGS TABLE
CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(64) PRIMARY KEY,
    conversation_id VARCHAR(64) NOT NULL,
    sender VARCHAR(16) NOT NULL, -- 'user' or 'ai'
    message TEXT NOT NULL,
    intent VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES FOR FAST QUERYING
CREATE INDEX IF NOT EXISTS idx_slots_parking ON parking_slots(parking_id);
CREATE INDEX IF NOT EXISTS idx_slots_status ON parking_slots(status);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- ============================================================
-- INITIAL SEED DATA
-- ============================================================

-- Seed Users
INSERT INTO users (id, name, email, password, role, phone, wallet_balance, avatar_url, auth_provider)
VALUES 
('usr-demo', 'Keshav Gupta', 'keshavgupta5060@gmail.com', 'password', 'admin', '+91-9876543210', 500.00, 'https://api.dicebear.com/7.x/bottts/svg?seed=keshavgupta5060@gmail.com', 'google')
ON CONFLICT (email) DO NOTHING;

-- Seed Parking Locations
INSERT INTO parking_locations (id, name, address, city, latitude, longitude, total_slots, opening_time, closing_time, status)
VALUES
('loc-1', 'Central Mall Underground', '123 MG Road, Sector 14', 'Gurugram', 28.4595, 77.0266, 40, '06:00', '23:59', 'active'),
('loc-2', 'Cyber Hub Parking Lot B', 'DLF Cyber City', 'Gurugram', 28.4950, 77.0895, 60, '24 Hours', '24 Hours', 'active'),
('loc-3', 'Metro Station Plaza', 'HUDA City Centre Metro Station', 'Gurugram', 28.4593, 77.0724, 25, '05:00', '00:00', 'active')
ON CONFLICT (id) DO NOTHING;

-- Seed Parking Slots
INSERT INTO parking_slots (id, parking_id, slot_number, slot_type, status, price_per_hr)
VALUES
('s1', 'loc-1', 'A-01', 'regular', 'available', 20.00),
('s2', 'loc-1', 'A-02', 'ev', 'available', 35.00),
('s3', 'loc-1', 'A-03', 'disabled', 'available', 20.00),
('s4', 'loc-2', 'B-01', 'regular', 'available', 25.00),
('s5', 'loc-2', 'B-02', 'ev', 'available', 40.00),
('s6', 'loc-3', 'C-01', 'regular', 'available', 15.00)
ON CONFLICT (id) DO NOTHING;

-- Seed Vehicles
INSERT INTO vehicles (id, user_id, registration_number, vehicle_type, model, color)
VALUES
('veh-1', 'usr-demo', 'MH12AB1234', 'car', 'Honda City', 'Pearl White'),
('veh-2', 'usr-demo', 'MH12EV9999', 'ev', 'Tata Nexon EV', 'Teal Blue')
ON CONFLICT (id) DO NOTHING;

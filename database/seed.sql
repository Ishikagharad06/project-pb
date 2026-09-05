-- ============================================================
-- ParkBy Database Seed Data Script
-- Imports initial seed records for Users, Locations, Slots & Vehicles
-- ============================================================

-- Insert Demo Admin User
INSERT INTO users (id, name, email, password, role, phone, wallet_balance, avatar_url, auth_provider)
VALUES 
('usr-demo', 'Keshav Gupta', 'keshavgupta5060@gmail.com', 'hashed_pass_123', 'admin', '+91-9876543210', 500.00, 'https://api.dicebear.com/7.x/bottts/svg?seed=keshavgupta5060@gmail.com', 'google')
ON CONFLICT (email) DO NOTHING;

-- Insert Locations
INSERT INTO parking_locations (id, name, address, city, latitude, longitude, total_slots, opening_time, closing_time, status)
VALUES
('loc-1', 'Central Mall Underground', '123 MG Road, Sector 14', 'Gurugram', 28.4595, 77.0266, 40, '06:00', '23:59', 'active'),
('loc-2', 'Cyber Hub Parking Lot B', 'DLF Cyber City', 'Gurugram', 28.4950, 77.0895, 60, '24 Hours', '24 Hours', 'active'),
('loc-3', 'Metro Station Plaza', 'HUDA City Centre Metro Station', 'Gurugram', 28.4593, 77.0724, 25, '05:00', '00:00', 'active')
ON CONFLICT (id) DO NOTHING;

-- Insert Slots
INSERT INTO parking_slots (id, parking_id, slot_number, slot_type, status, price_per_hr)
VALUES
('s1', 'loc-1', 'A-01', 'regular', 'available', 20.00),
('s2', 'loc-1', 'A-02', 'ev', 'available', 35.00),
('s3', 'loc-1', 'A-03', 'accessible', 'available', 20.00),
('s4', 'loc-2', 'B-01', 'regular', 'available', 25.00),
('s5', 'loc-2', 'B-02', 'ev', 'available', 40.00),
('s6', 'loc-3', 'C-01', 'regular', 'available', 15.00)
ON CONFLICT (id) DO NOTHING;

-- Insert Vehicles
INSERT INTO vehicles (id, user_id, registration_number, vehicle_type, model, color)
VALUES
('veh-1', 'usr-demo', 'HR26AB1234', 'car', 'Honda City', 'White'),
('veh-2', 'usr-demo', 'HR26EV9999', 'ev', 'Tata Nexon EV', 'Teal')
ON CONFLICT (id) DO NOTHING;

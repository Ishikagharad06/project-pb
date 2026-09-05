import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

console.log("DATABASE_URL exists:", !!connectionString);
console.log(
  "DATABASE_URL starts correctly:",
  connectionString?.startsWith("postgresql://")
);

if (!connectionString) {
  throw new Error("DATABASE_URL is missing");
}

export const pool = new Pool({
  connectionString
});

export async function testNeonConnection() {
  const result = await pool.query('SELECT NOW() AS current_time');

  console.log('✅ Neon connected successfully!');
  console.log('Database time:', result.rows[0].current_time);
}

export async function testDatabaseTables() {
  const result = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);

  console.log("📋 Neon tables:");
  console.table(result.rows);
}

export async function inspectParkingSlots() {
  const result = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'parking_slots'
    ORDER BY ordinal_position;
  `);

  console.table(result.rows);
}

export async function inspectParkingTables() {
  const tables = [
    'parking_locations',
    'parking_pricing',
    'bookings',
    'payments'
  ];

  for (const table of tables) {
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position;
    `, [table]);

    console.log(`\n📋 ${table}`);
    console.table(result.rows);
  }
}

export async function inspectParkingData() {
  const result = await pool.query(`
    SELECT
      ps.id,
      ps.slot_number,
      ps.slot_type,
      ps.status,
      ps.parking_id,
      pl.name AS parking_name
    FROM parking_slots ps
    LEFT JOIN parking_locations pl
      ON ps.parking_id = pl.id
    ORDER BY pl.name, ps.slot_number;
  `);

  console.log("🅿️ Actual Neon parking slots:");
  console.table(result.rows);
}

// ============================================================
// Pay & Park: bookings + payments (Neon-backed)
// ============================================================

// Idempotent — only creates the table if it doesn't already exist.
// If `payments` already exists in your Neon DB with different columns,
// this is a no-op and you should tell me the real column list so I can adjust.
export async function ensurePaymentsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR(64) PRIMARY KEY,
      booking_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64),
      amount DECIMAL(10, 2) NOT NULL,
      payment_method VARCHAR(32) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      transaction_id VARCHAR(128),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// Single slot lookup with live price, mirrors getNeonSlots() below.
export async function getNeonSlotById(slotId: string) {
  const result = await pool.query(
    `
    SELECT
      ps.id,
      ps.slot_number,
      ps.slot_type,
      ps.status,
      ps.parking_id,
      pl.name AS parking_name,
      COALESCE(pp.hourly_rate, 0) AS price_per_hr
    FROM parking_slots ps
    LEFT JOIN parking_locations pl
      ON ps.parking_id = pl.id
    LEFT JOIN LATERAL (
      SELECT hourly_rate
      FROM parking_pricing
      WHERE parking_id = ps.parking_id
        AND (effective_from IS NULL OR effective_from <= NOW())
        AND (effective_until IS NULL OR effective_until >= NOW())
      ORDER BY effective_from DESC
      LIMIT 1
    ) pp ON true
    WHERE ps.id = $1
    `,
    [slotId]
  );
  return result.rows[0] || null;
}

export async function markSlotOccupied(slotId: string) {
  await pool.query(`UPDATE parking_slots SET status = 'occupied' WHERE id = $1`, [slotId]);
}

export async function markSlotAvailable(slotId: string) {
  await pool.query(`UPDATE parking_slots SET status = 'available' WHERE id = $1`, [slotId]);
}

export async function createNeonBooking(params: {
  id: string;
  user_id: string;
  parking_id: string;
  parking_name: string;
  slot_id: string;
  slot_number: string;
  vehicle_number: string;
  start_time: Date;
  scheduled_end_time: Date;
  base_amount: number;
}) {
  // Find the vehicle belonging to this user
  const vehicleResult = await pool.query(
    `SELECT id
     FROM vehicles
     WHERE user_id = $1
       AND registration_number = $2
     LIMIT 1`,
    [params.user_id, params.vehicle_number]
  );

  if (vehicleResult.rows.length === 0) {
    throw new Error(
      `Vehicle ${params.vehicle_number} not found for user ${params.user_id}`
    );
  }

  const vehicleId = vehicleResult.rows[0].id;

  const result = await pool.query(
    `INSERT INTO bookings
      (id, user_id, parking_id, slot_id, vehicle_id,
       start_time, scheduled_end_time, status,
       base_amount, extension_amount, total_amount)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, 0, $8)
     RETURNING *`,
    [
      params.id,
      params.user_id,
      params.parking_id,
      params.slot_id,
      vehicleId,
      params.start_time,
      params.scheduled_end_time,
      params.base_amount
    ]
  );

  return result.rows[0];
}

export async function getNeonBookingById(bookingId: string) {
  const result = await pool.query(`SELECT * FROM bookings WHERE id = $1`, [bookingId]);
  return result.rows[0] || null;
}

export async function createNeonPayment(params: {
  id: string;
  booking_id: string;
  user_id: string;
  amount: number;
  payment_method: string;
  status: string;
  transaction_id: string;
}) {
  const result = await pool.query(
  `INSERT INTO payments
    (id, booking_id, user_id, amount, payment_method, payment_status, transaction_id, paid_at)
   VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
   RETURNING *`,
  [
    params.id,
    params.booking_id,
    params.user_id,
    params.amount,
    params.payment_method,
    params.status,
    params.transaction_id
  ]
);
  return result.rows[0];
}

// Only flips 'pending' -> 'active'. Returns null if booking wasn't pending
// (e.g. already active, cancelled, or doesn't exist) so callers can detect that.
export async function activateNeonBooking(bookingId: string) {
  const result = await pool.query(
    `UPDATE bookings SET status = 'active' WHERE id = $1 AND status = 'pending' RETURNING *`,
    [bookingId]
  );
  return result.rows[0] || null;
}

export async function extendNeonBooking(bookingId: string, additionalHours: number) {
  const bkRes = await pool.query(`SELECT * FROM bookings WHERE id = $1 AND status = 'active'`, [bookingId]);
  const bk = bkRes.rows[0];
  if (!bk) return null;

  const slot = await getNeonSlotById(bk.slot_id);
  const pricePerHr = slot ? Number(slot.price_per_hr) : 0;
  const addAmount = pricePerHr * additionalHours;

  const result = await pool.query(
    `UPDATE bookings
     SET scheduled_end_time = scheduled_end_time + ($1 || ' hours')::interval,
         extension_amount = extension_amount + $2,
         total_amount = total_amount + $2
     WHERE id = $3
     RETURNING *`,
    [additionalHours, addAmount, bookingId]
  );
  return result.rows[0];
}

export async function cancelNeonBooking(bookingId: string) {
  const result = await pool.query(
    `UPDATE bookings SET status = 'cancelled', actual_end_time = NOW()
     WHERE id = $1 AND status IN ('pending', 'active')
     RETURNING *`,
    [bookingId]
  );
  const bk = result.rows[0];
  if (bk) {
    await markSlotAvailable(bk.slot_id);
  }
  return bk || null;
}

export async function getNeonUserBookings(userId?: string) {
  const result = userId
    ? await pool.query(`SELECT * FROM bookings WHERE user_id = $1 ORDER BY start_time DESC`, [userId])
    : await pool.query(`SELECT * FROM bookings ORDER BY start_time DESC`);
  return result.rows;
}

// Auto-expiry: flips overdue active bookings to completed and frees their slots.
// Called on an interval from server.ts, and opportunistically before reads.
export async function completeExpiredNeonBookings() {
  const result = await pool.query(
    `UPDATE bookings SET status = 'completed', actual_end_time = NOW()
     WHERE status = 'active' AND scheduled_end_time <= NOW()
     RETURNING slot_id`
  );
  const slotIds = result.rows.map(r => r.slot_id);
  if (slotIds.length > 0) {
    await pool.query(`UPDATE parking_slots SET status = 'available' WHERE id = ANY($1)`, [slotIds]);
  }
  return slotIds.length;
}

export async function getNeonSlots(locationId?: string) {
  const result = await pool.query(
    `
    SELECT
      ps.id,
      ps.slot_number,
      ps.slot_type,
      ps.status,
      ps.parking_id,
      pl.name AS parking_name,
      pl.name AS location_name,
      COALESCE(pp.hourly_rate, 0) AS price_per_hr
    FROM parking_slots ps
    LEFT JOIN parking_locations pl
      ON ps.parking_id = pl.id
    LEFT JOIN LATERAL (
      SELECT hourly_rate
      FROM parking_pricing
      WHERE parking_id = ps.parking_id
        AND (effective_from IS NULL OR effective_from <= NOW())
        AND (effective_until IS NULL OR effective_until >= NOW())
      ORDER BY effective_from DESC
      LIMIT 1
    ) pp ON true
    WHERE ($1::uuid IS NULL OR ps.parking_id = $1::uuid)
    ORDER BY pl.name, ps.slot_number
    `,
    [locationId || null]
  );

  return result.rows;
}
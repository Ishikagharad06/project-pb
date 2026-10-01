import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const cols = await pool.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'parking_slots'
  ORDER BY ordinal_position
`);
console.table(cols.rows);

const locCols = await pool.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'parking_locations'
  ORDER BY ordinal_position
`);
console.table(locCols.rows);

const locs = await pool.query(
  'SELECT id, name, total_slots, status FROM parking_locations ORDER BY name'
);
console.table(locs.rows);

const slots = await pool.query(`
  SELECT ps.id, ps.slot_number, ps.status, pl.name
  FROM parking_slots ps
  LEFT JOIN parking_locations pl ON pl.id = ps.parking_id
  ORDER BY pl.name, ps.slot_number
`);
console.log('slot count', slots.rows.length);
console.table(slots.rows);
await pool.end();

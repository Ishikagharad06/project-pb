import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const profilesCols = await pool.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'profiles'
     ORDER BY ordinal_position`
  );
  console.log('PROFILES COLS', JSON.stringify(profilesCols.rows));

  const extCols = await pool.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'booking_extensions'
     ORDER BY ordinal_position`
  );
  console.log('EXT COLS', JSON.stringify(extCols.rows));

  const checks = await pool.query(`
    SELECT conrelid::regclass::text AS table_name, conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE contype = 'c'
      AND conrelid::regclass::text IN ('bookings','payments','parking_slots','vehicles','profiles')
  `);
  console.log('CHECKS', JSON.stringify(checks.rows));

  const counts = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM profiles) AS profiles,
      (SELECT COUNT(*) FROM vehicles) AS vehicles,
      (SELECT COUNT(*) FROM booking_extensions) AS extensions
  `);
  console.log('COUNTS', counts.rows[0]);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

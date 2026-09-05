require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  try {
    await pool.query(`
      UPDATE vehicles
      SET user_id = '8a1f636a-f688-4192-a9f9-41113a61761b'
      WHERE registration_number = 'MH12AB1234'
    `);

    console.log('✅ Vehicle assigned to Keshav successfully');
  } catch (error) {
    console.error('❌', error);
  } finally {
    await pool.end();
  }
}

main();
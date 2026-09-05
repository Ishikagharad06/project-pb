import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function testDatabaseConnection() {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("✅ Neon connected:", result.rows[0]);
  } catch (error) {
    console.error("❌ Neon connection failed:", error);
  }
}

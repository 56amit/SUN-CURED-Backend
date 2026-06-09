import { Client } from "pg";
import "dotenv/config";

async function diagnose() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to Neon DB successfully!");

    // Public schema ke saare tables list karenge
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log("Tables in database:", res.rows.map(r => r.table_name));
  } catch (err) {
    console.error("Database error details:", err);
  } finally {
    await client.end();
  }
}

diagnose();

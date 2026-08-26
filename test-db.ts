import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const testConnection = async () => {
  console.log("Testing DB Connection...");
  console.log("URL:", process.env.DATABASE_URL);
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log("✅ Connection Successful!");
    const res = await client.query('SELECT NOW()');
    console.log("Current Time from DB:", res.rows[0]);
    await client.end();
  } catch (err) {
    console.error("❌ Connection Failed:");
    console.error(err);
  }
};

testConnection();

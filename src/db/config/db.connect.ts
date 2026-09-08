import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

let db: any = null;

if (process.env.DATABASE_URL) {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    db = drizzle(pool);
  } catch (err) {
    console.warn("Failed to initialize database client:", err);
    db = {} as any;
  }
} else {
  console.warn("DATABASE_URL not set. Database client not initialized.");
  // Provide a noop stub to avoid import-time errors; runtime calls will fail explicitly.
  db = new Proxy(
    {},
    {
      get() {
        return () => {
          throw new Error(
            "Database not configured. Set DATABASE_URL environment variable.",
          );
        };
      },
    },
  ) as any;
}

export default db;

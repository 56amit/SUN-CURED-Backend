import "dotenv/config";
import { defineConfig, Config } from "drizzle-kit";

const config: Config = defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});

export default config;

import path from "node:path";

import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env.local first (local overrides), then .env as fallback
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const directUrl = process.env["DIRECT_URL"];
const databaseUrl = process.env["DATABASE_URL"];

if (!directUrl && databaseUrl) {
  console.warn(
    "[prisma.config.ts] WARNING: DIRECT_URL is not set. Falling back to DATABASE_URL for migrations.\n" +
      "Neon requires a direct (non-pooled) connection for migrations. If DATABASE_URL uses\n" +
      "connection pooling, migrations will fail. Set DIRECT_URL to the non-pooled connection string."
  );
}

export default defineConfig({
  schema: path.join("prisma", "schema"),
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: directUrl || databaseUrl,
  },
});

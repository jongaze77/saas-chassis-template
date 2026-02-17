import { PrismaNeon } from "@prisma/adapter-neon";
import dotenv from "dotenv";
import { z } from "zod";

import { PrismaClient } from "../src/generated/prisma/client";

// Load .env.local first (local overrides), then .env as fallback
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

// Validate DATABASE_URL before use — same Zod pattern as @/lib/env
const seedEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
});

const seedEnv = seedEnvSchema.parse(process.env);

const adapter = new PrismaNeon({ connectionString: seedEnv.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Seed data will be added as models grow
  console.log("Seed complete.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

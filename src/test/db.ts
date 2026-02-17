import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

function createTestClient() {
  const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const testPrisma = createTestClient();

export async function cleanupTestData() {
  // Delete in reverse dependency order
  await testPrisma.event.deleteMany();
  await testPrisma.session.deleteMany();
  await testPrisma.verificationToken.deleteMany();
  await testPrisma.accountSummary.deleteMany();
  await testPrisma.user.deleteMany();
  await testPrisma.account.deleteMany();
}

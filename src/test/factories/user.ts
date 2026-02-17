import { testPrisma } from "@/test/db";

let userCounter = 0;

export async function createTestUser(
  accountId: string,
  overrides: { name?: string; email?: string } = {}
) {
  userCounter++;
  return testPrisma.user.create({
    data: {
      accountId,
      name: overrides.name ?? `Test User ${userCounter}`,
      email: overrides.email ?? `testuser${userCounter}-${Date.now()}@test.com`,
    },
  });
}

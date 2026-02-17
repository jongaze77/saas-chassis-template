import { testPrisma } from "@/test/db";

let accountCounter = 0;

export async function createTestAccount(
  overrides: { name?: string } = {}
) {
  accountCounter++;
  return testPrisma.account.create({
    data: {
      name: overrides.name ?? `Test Account ${accountCounter}`,
    },
  });
}

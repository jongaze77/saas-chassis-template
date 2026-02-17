import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

function createPrismaClient() {
  const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: InstanceType<typeof PrismaClient> | undefined;
};

const basePrisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}

// Models that require tenant scoping (have account_id FK)
const TENANT_SCOPED_MODELS = new Set([
  "User",
  "Session",
  "Event",
  "AccountSummary",
]);

// Models exempt from tenant scoping
const UNSCOPED_MODELS = new Set(["Account", "VerificationToken"]);

// Operations that need tenant filtering
const READ_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

const WRITE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);

type BasePrismaClient = typeof basePrisma;

export function createTenantScopedClient(accountId: string): BasePrismaClient {
  return basePrisma.$extends({
    query: {
      $allOperations({ model, operation, args, query }) {
        if (!model || UNSCOPED_MODELS.has(model)) {
          return query(args);
        }

        if (!TENANT_SCOPED_MODELS.has(model)) {
          return query(args);
        }

        if (READ_OPERATIONS.has(operation)) {
          args.where = { ...args.where, accountId };
          return query(args);
        }

        if (WRITE_OPERATIONS.has(operation)) {
          if (operation === "create") {
            args.data = { ...args.data, accountId };
          } else if (
            operation === "createMany" ||
            operation === "createManyAndReturn"
          ) {
            if (Array.isArray(args.data)) {
              args.data = args.data.map(
                (d: Record<string, unknown>) => ({
                  ...d,
                  accountId,
                })
              );
            } else {
              args.data = { ...args.data, accountId };
            }
          } else if (
            operation === "update" ||
            operation === "updateMany" ||
            operation === "updateManyAndReturn" ||
            operation === "delete" ||
            operation === "deleteMany"
          ) {
            args.where = { ...args.where, accountId };
          } else if (operation === "upsert") {
            args.where = { ...args.where, accountId };
            args.create = { ...args.create, accountId };
          }
          return query(args);
        }

        return query(args);
      },
    },
  }) as unknown as BasePrismaClient;
}

/**
 * Returns an unscoped Prisma client for system operations.
 * Only use for Inngest jobs, admin operations, and cross-account aggregation.
 * NEVER use in user-facing request handlers.
 */
export function withoutTenantScope() {
  return basePrisma;
}

export type TenantScopedClient = ReturnType<typeof createTenantScopedClient>;

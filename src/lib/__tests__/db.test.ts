import { describe, expect, it, vi } from "vitest";

// Mock env module before any imports that need it
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost/testdb",
    NODE_ENV: "test",
  },
}));

// Mock external deps
vi.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: vi.fn(),
}));

vi.mock("@/generated/prisma/client", () => {
  class MockPrismaClient {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- matches real PrismaClient constructor signature
    constructor(_opts: unknown) {
      // Accept adapter option
    }

    $extends(extension: unknown) {
      return { _extension: extension, _isTenantScoped: true };
    }

    $disconnect() {
      return Promise.resolve();
    }
  }

  return { PrismaClient: MockPrismaClient };
});

describe("Tenant Scoping", () => {
  it("createTenantScopedClient returns an extended client", async () => {
    const { createTenantScopedClient } = await import("@/lib/db");
    const client = createTenantScopedClient("test-account-id");

    expect(client).toBeDefined();
    expect(
      (client as unknown as { _isTenantScoped: boolean })._isTenantScoped
    ).toBe(true);
  });

  it("withoutTenantScope returns the base client without extensions", async () => {
    const { withoutTenantScope } = await import("@/lib/db");
    const client = withoutTenantScope();

    expect(client).toBeDefined();
    expect(
      (client as unknown as { _isTenantScoped?: boolean })._isTenantScoped
    ).toBeUndefined();
  });

  it("tenant scoping extension injects accountId into read queries", async () => {
    const { createTenantScopedClient } = await import("@/lib/db");
    const client = createTenantScopedClient("acc_test123");

    const extension = (
      client as unknown as {
        _extension: { query: { $allOperations: (...args: unknown[]) => unknown } };
      }
    )._extension;
    const allOps = extension.query.$allOperations;

    const capturedArgs = { where: { email: "test@test.com" } };
    const mockQuery = vi.fn().mockResolvedValue([]);

    await allOps({
      model: "User",
      operation: "findMany",
      args: capturedArgs,
      query: mockQuery,
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: "acc_test123" }),
      })
    );
  });

  it("tenant scoping extension injects accountId into create operations", async () => {
    const { createTenantScopedClient } = await import("@/lib/db");
    const client = createTenantScopedClient("acc_test456");

    const extension = (
      client as unknown as {
        _extension: { query: { $allOperations: (...args: unknown[]) => unknown } };
      }
    )._extension;
    const allOps = extension.query.$allOperations;

    const capturedArgs = {
      data: { name: "Test User", email: "test@test.com" },
    };
    const mockQuery = vi.fn().mockResolvedValue({});

    await allOps({
      model: "User",
      operation: "create",
      args: capturedArgs,
      query: mockQuery,
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accountId: "acc_test456" }),
      })
    );
  });

  it("tenant scoping skips unscoped models like Account", async () => {
    const { createTenantScopedClient } = await import("@/lib/db");
    const client = createTenantScopedClient("acc_test789");

    const extension = (
      client as unknown as {
        _extension: { query: { $allOperations: (...args: unknown[]) => unknown } };
      }
    )._extension;
    const allOps = extension.query.$allOperations;

    const capturedArgs = { where: { id: "some-id" } };
    const mockQuery = vi.fn().mockResolvedValue({});

    await allOps({
      model: "Account",
      operation: "findUnique",
      args: capturedArgs,
      query: mockQuery,
    });

    expect(mockQuery).toHaveBeenCalledWith({
      where: { id: "some-id" },
    });
  });

  it("tenant scoping skips VerificationToken model", async () => {
    const { createTenantScopedClient } = await import("@/lib/db");
    const client = createTenantScopedClient("acc_test000");

    const extension = (
      client as unknown as {
        _extension: { query: { $allOperations: (...args: unknown[]) => unknown } };
      }
    )._extension;
    const allOps = extension.query.$allOperations;

    const capturedArgs = { where: { token: "verify-token" } };
    const mockQuery = vi.fn().mockResolvedValue({});

    await allOps({
      model: "VerificationToken",
      operation: "findUnique",
      args: capturedArgs,
      query: mockQuery,
    });

    expect(mockQuery).toHaveBeenCalledWith({
      where: { token: "verify-token" },
    });
  });

  it("tenant scoping injects accountId into createManyAndReturn data items", async () => {
    const { createTenantScopedClient } = await import("@/lib/db");
    const client = createTenantScopedClient("acc_cmr");

    const extension = (
      client as unknown as {
        _extension: { query: { $allOperations: (...args: unknown[]) => unknown } };
      }
    )._extension;
    const allOps = extension.query.$allOperations;

    const capturedArgs = {
      data: [
        { name: "User A", email: "a@test.com" },
        { name: "User B", email: "b@test.com" },
      ],
    };
    const mockQuery = vi.fn().mockResolvedValue([]);

    await allOps({
      model: "User",
      operation: "createManyAndReturn",
      args: capturedArgs,
      query: mockQuery,
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({ accountId: "acc_cmr", name: "User A" }),
          expect.objectContaining({ accountId: "acc_cmr", name: "User B" }),
        ],
      })
    );
  });

  it("tenant scoping injects accountId into updateManyAndReturn where clause", async () => {
    const { createTenantScopedClient } = await import("@/lib/db");
    const client = createTenantScopedClient("acc_umr");

    const extension = (
      client as unknown as {
        _extension: { query: { $allOperations: (...args: unknown[]) => unknown } };
      }
    )._extension;
    const allOps = extension.query.$allOperations;

    const capturedArgs = {
      where: { name: "Test" },
      data: { name: "Updated" },
    };
    const mockQuery = vi.fn().mockResolvedValue([]);

    await allOps({
      model: "User",
      operation: "updateManyAndReturn",
      args: capturedArgs,
      query: mockQuery,
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: "acc_umr" }),
      })
    );
  });

  it("tenant scoping injects accountId into update operations", async () => {
    const { createTenantScopedClient } = await import("@/lib/db");
    const client = createTenantScopedClient("acc_update");

    const extension = (
      client as unknown as {
        _extension: { query: { $allOperations: (...args: unknown[]) => unknown } };
      }
    )._extension;
    const allOps = extension.query.$allOperations;

    const capturedArgs = {
      where: { id: "user-1" },
      data: { name: "Updated" },
    };
    const mockQuery = vi.fn().mockResolvedValue({});

    await allOps({
      model: "User",
      operation: "update",
      args: capturedArgs,
      query: mockQuery,
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: "acc_update" }),
      })
    );
  });
});

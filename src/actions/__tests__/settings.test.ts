import crypto from "crypto";

import bcrypt from "bcrypt";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies BEFORE importing the module under test
vi.mock("@/lib/db", () => ({
  withoutTenantScope: vi.fn(),
  createTenantScopedClient: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2b$12$mockedhashedpassword"),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const { mockCheckRateLimit, mockGetClientIp } = vi.hoisted(() => {
  return {
    mockCheckRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
    mockGetClientIp: vi.fn().mockReturnValue("127.0.0.1"),
  };
});

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ "x-forwarded-for": "127.0.0.1" })),
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getClientIp: mockGetClientIp,
  updateProfileLimiter: {},
  requestEmailChangeLimiter: {},
  verifyEmailLimiter: {},
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXTAUTH_URL: "http://localhost:3001",
    NEXTAUTH_SECRET: "test-secret",
    DATABASE_URL: "postgresql://test",
    NODE_ENV: "test",
  },
}));

import { updateProfile, requestEmailChange, confirmEmailChange } from "@/actions/settings";
import { auth } from "@/lib/auth";
import { withoutTenantScope, createTenantScopedClient } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";

// Helper to create mock Prisma transaction client
function createMockTenantPrisma() {
  const mockTx = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    verificationToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    event: {
      create: vi.fn().mockResolvedValue({ id: "event-1" }),
    },
    session: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };

  const mockPrisma = {
    ...mockTx,
    $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
      return fn(mockTx);
    }),
  };

  return { mockPrisma, mockTx };
}

// Default authenticated session mock
const mockSession = {
  user: { id: "user-1", accountId: "account-1", email: "test@example.com" },
};

// ---------------------------------------------------------------------------
// updateProfile
// ---------------------------------------------------------------------------
describe("updateProfile", () => {
  let mockPrisma: ReturnType<typeof createMockTenantPrisma>["mockPrisma"];
  let mockTx: ReturnType<typeof createMockTenantPrisma>["mockTx"];

  beforeEach(() => {
    vi.clearAllMocks();
    const mocks = createMockTenantPrisma();
    mockPrisma = mocks.mockPrisma;
    mockTx = mocks.mockTx;
    vi.mocked(createTenantScopedClient).mockReturnValue(mockPrisma as never);
    vi.mocked(auth).mockResolvedValue(mockSession as never);

    mockTx.user.update.mockResolvedValue({
      id: "user-1",
      name: "New Name",
      email: "test@example.com",
    });
  });

  it("returns success when valid name provided", async () => {
    const formData = new FormData();
    formData.set("name", "New Name");

    const result = await updateProfile(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "New Name" });
      expect(result.warning).toBe("Profile name updated successfully.");
    }
  });

  it("returns error when name is empty", async () => {
    const formData = new FormData();
    formData.set("name", "");

    const result = await updateProfile(formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Name is required");
  });

  it("returns error when name exceeds 100 characters", async () => {
    const formData = new FormData();
    formData.set("name", "a".repeat(101));

    const result = await updateProfile(formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Name must be 100 characters or fewer");
  });

  it("returns rate limit error when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 30 });

    const formData = new FormData();
    formData.set("name", "New Name");

    const result = await updateProfile(formData);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Too many attempts");
    expect(result.error).toContain("30 seconds");
  });

  it("rate limit check happens BEFORE validation and DB access", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 30 });

    const formData = new FormData();
    formData.set("name", "New Name");

    await updateProfile(formData);

    // DB should never be accessed when rate-limited
    expect(createTenantScopedClient).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    // Auth should not be called either
    expect(auth).not.toHaveBeenCalled();
  });

  it("creates SETTINGS_UPDATED event in transaction", async () => {
    const formData = new FormData();
    formData.set("name", "New Name");

    await updateProfile(formData);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "SETTINGS_UPDATED",
        actorType: "USER",
        actorId: "user-1",
        targetType: "User",
        targetId: "user-1",
        payload: { field: "name", userId: "user-1" },
      }),
    });
  });

  it("requires authenticated session — returns error without session", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const formData = new FormData();
    formData.set("name", "New Name");

    const result = await updateProfile(formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Something went wrong. Please try again.");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns error when session user has no accountId", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user-1", accountId: undefined },
    } as never);

    const formData = new FormData();
    formData.set("name", "New Name");

    const result = await updateProfile(formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Something went wrong. Please try again.");
  });

  it("uses tenant-scoped client with accountId from session", async () => {
    const formData = new FormData();
    formData.set("name", "New Name");

    await updateProfile(formData);

    expect(createTenantScopedClient).toHaveBeenCalledWith("account-1");
  });

  it("updates user name via prisma in transaction", async () => {
    const formData = new FormData();
    formData.set("name", "Updated Name");
    mockTx.user.update.mockResolvedValueOnce({
      id: "user-1",
      name: "Updated Name",
      email: "test@example.com",
    });

    const result = await updateProfile(formData);

    expect(result.success).toBe(true);
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name: "Updated Name" },
    });
  });

  it("returns generic error when transaction throws", async () => {
    mockPrisma.$transaction.mockRejectedValueOnce(new Error("DB connection lost"));

    const formData = new FormData();
    formData.set("name", "New Name");

    const result = await updateProfile(formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Something went wrong. Please try again.");
  });

  it("trims whitespace from name via schema", async () => {
    const formData = new FormData();
    formData.set("name", "  Padded Name  ");
    mockTx.user.update.mockResolvedValueOnce({
      id: "user-1",
      name: "Padded Name",
      email: "test@example.com",
    });

    await updateProfile(formData);

    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name: "Padded Name" },
    });
  });

  it("accepts name at exactly 100 characters (boundary)", async () => {
    const longName = "a".repeat(100);
    const formData = new FormData();
    formData.set("name", longName);
    mockTx.user.update.mockResolvedValueOnce({
      id: "user-1",
      name: longName,
      email: "test@example.com",
    });

    const result = await updateProfile(formData);

    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// requestEmailChange
// ---------------------------------------------------------------------------
describe("requestEmailChange", () => {
  let tenantPrisma: ReturnType<typeof createMockTenantPrisma>["mockPrisma"];
  let unscopedPrisma: ReturnType<typeof createMockTenantPrisma>["mockPrisma"];
  let unscopedTx: ReturnType<typeof createMockTenantPrisma>["mockTx"];

  beforeEach(() => {
    vi.clearAllMocks();

    // Tenant-scoped client — for user lookup
    const tenantMocks = createMockTenantPrisma();
    tenantPrisma = tenantMocks.mockPrisma;

    // Unscoped client — for VerificationToken transaction
    const unscopedMocks = createMockTenantPrisma();
    unscopedPrisma = unscopedMocks.mockPrisma;
    unscopedTx = unscopedMocks.mockTx;

    vi.mocked(createTenantScopedClient).mockReturnValue(tenantPrisma as never);
    vi.mocked(withoutTenantScope).mockReturnValue(unscopedPrisma as never);
    vi.mocked(auth).mockResolvedValue(mockSession as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    // Default: user exists with a password hash
    tenantPrisma.user.findUnique.mockResolvedValue({
      email: "test@example.com",
      passwordHash: "$2b$12$existinghash",
      name: "Test User",
    });

    // Default: no other user with the new email (primary or pending)
    // These checks now run INSIDE the transaction (on unscopedTx, not unscopedPrisma)
    unscopedTx.user.findUnique.mockResolvedValue(null);
    unscopedTx.user.findFirst.mockResolvedValue(null);

    vi.spyOn(crypto, "randomBytes").mockReturnValue(
      Buffer.from("test-token-secure-bytes-32chars!!") as never,
    );
  });

  it("returns success message when valid email and password provided", async () => {
    const formData = new FormData();
    formData.set("newEmail", "new@example.com");
    formData.set("currentPassword", "password123");

    const result = await requestEmailChange(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.warning).toBe(
        "Verification email sent. Your email will update after you verify.",
      );
    }
  });

  it("returns same success message when new email is available (happy path)", async () => {
    // No other user has this email — proceeds normally
    const formData = new FormData();
    formData.set("newEmail", "available@example.com");
    formData.set("currentPassword", "password123");

    const result = await requestEmailChange(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.warning).toBe(
        "Verification email sent. Your email will update after you verify.",
      );
    }
  });

  it("returns same success but skips token when new email is another user's primary email", async () => {
    // Another user owns this email — enumeration prevention: return success, skip token
    // Uniqueness check happens INSIDE the transaction to prevent race conditions (R3-H2)
    unscopedTx.user.findUnique.mockResolvedValueOnce({ id: "user-other" });

    const formData = new FormData();
    formData.set("newEmail", "taken@example.com");
    formData.set("currentPassword", "password123");

    const result = await requestEmailChange(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.warning).toBe(
        "Verification email sent. Your email will update after you verify.",
      );
    }
    // Transaction runs, but token creation is skipped inside it
    expect(unscopedPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(unscopedTx.verificationToken.create).not.toHaveBeenCalled();
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it("returns same success but skips token when new email is another user's pending email", async () => {
    // No primary user with that email, but another user has it as pendingEmail
    // Uniqueness check happens INSIDE the transaction to prevent race conditions (R3-H2)
    unscopedTx.user.findUnique.mockResolvedValueOnce(null);
    unscopedTx.user.findFirst.mockResolvedValueOnce({ id: "user-other" });

    const formData = new FormData();
    formData.set("newEmail", "pending@example.com");
    formData.set("currentPassword", "password123");

    const result = await requestEmailChange(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.warning).toBe(
        "Verification email sent. Your email will update after you verify.",
      );
    }
    // Transaction runs, but token creation is skipped inside it
    expect(unscopedPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(unscopedTx.verificationToken.create).not.toHaveBeenCalled();
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it("allows email change when primary user check returns the same user (re-request)", async () => {
    // Edge case: the user's own email is found (shouldn't happen since we check
    // email != current, but defensive — same user ID should not block)
    // Uniqueness check happens INSIDE the transaction (R3-H2)
    unscopedTx.user.findUnique.mockResolvedValueOnce({ id: "user-1" });

    const formData = new FormData();
    formData.set("newEmail", "new@example.com");
    formData.set("currentPassword", "password123");

    const result = await requestEmailChange(formData);

    expect(result.success).toBe(true);
    // Transaction SHOULD proceed and create token — same user ID is not a blocker
    expect(unscopedPrisma.$transaction).toHaveBeenCalled();
    expect(unscopedTx.verificationToken.create).toHaveBeenCalled();
  });

  it("returns error when current password is incorrect", async () => {
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);

    const formData = new FormData();
    formData.set("newEmail", "new@example.com");
    formData.set("currentPassword", "wrongpassword");

    const result = await requestEmailChange(formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Current password is incorrect");
  });

  it("returns error when new email matches current email (before password check)", async () => {
    const formData = new FormData();
    formData.set("newEmail", "test@example.com");
    formData.set("currentPassword", "password123");

    const result = await requestEmailChange(formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe("New email must be different from current email");
    // Email equality check should occur BEFORE bcrypt.compare (R2-M2 UX fix)
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it("returns rate limit error when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 60 });

    const formData = new FormData();
    formData.set("newEmail", "new@example.com");
    formData.set("currentPassword", "password123");

    const result = await requestEmailChange(formData);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Too many attempts");
    expect(result.error).toContain("60 seconds");
  });

  it("rate limit check happens BEFORE validation and DB access", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 60 });

    const formData = new FormData();
    formData.set("newEmail", "new@example.com");
    formData.set("currentPassword", "password123");

    await requestEmailChange(formData);

    expect(auth).not.toHaveBeenCalled();
    expect(createTenantScopedClient).not.toHaveBeenCalled();
    expect(tenantPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(unscopedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates VerificationToken with hashed token", async () => {
    const formData = new FormData();
    formData.set("newEmail", "new@example.com");
    formData.set("currentPassword", "password123");

    await requestEmailChange(formData);

    expect(unscopedTx.verificationToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        identifier: "new@example.com",
        // Token should be SHA-256 hashed (64 hex chars)
        token: expect.stringMatching(/^[a-f0-9]{64}$/),
        expires: expect.any(Date),
      }),
    });
  });

  it("sets user pendingEmail field in transaction", async () => {
    const formData = new FormData();
    formData.set("newEmail", "new@example.com");
    formData.set("currentPassword", "password123");

    await requestEmailChange(formData);

    expect(unscopedTx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { pendingEmail: "new@example.com" },
    });
  });

  it("deletes old tokens for the new email before creating a new one", async () => {
    const formData = new FormData();
    formData.set("newEmail", "new@example.com");
    formData.set("currentPassword", "password123");

    await requestEmailChange(formData);

    expect(unscopedTx.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: "new@example.com" },
    });

    // deleteMany should be called before create
    const deleteManyOrder =
      unscopedTx.verificationToken.deleteMany.mock.invocationCallOrder[0];
    const createOrder =
      unscopedTx.verificationToken.create.mock.invocationCallOrder[0];
    expect(deleteManyOrder).toBeLessThan(createOrder);
  });

  it("sends verification email via Inngest", async () => {
    const formData = new FormData();
    formData.set("newEmail", "new@example.com");
    formData.set("currentPassword", "password123");

    await requestEmailChange(formData);

    expect(inngest.send).toHaveBeenCalledWith({
      name: "auth/email-change.requested",
      data: {
        email: "new@example.com",
        name: "Test User",
        // The plaintext token (base64url), NOT the SHA-256 hash
        token: "dGVzdC10b2tlbi1zZWN1cmUtYnl0ZXMtMzJjaGFycyEh",
      },
    });
  });

  it("creates SETTINGS_UPDATED audit event in transaction", async () => {
    const formData = new FormData();
    formData.set("newEmail", "new@example.com");
    formData.set("currentPassword", "password123");

    await requestEmailChange(formData);

    expect(unscopedTx.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "SETTINGS_UPDATED",
        actorType: "USER",
        actorId: "user-1",
        targetType: "User",
        targetId: "user-1",
        accountId: "account-1",
        payload: { field: "email_change_requested", userId: "user-1" },
      }),
    });
  });

  it("requires authenticated session — returns error without session", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const formData = new FormData();
    formData.set("newEmail", "new@example.com");
    formData.set("currentPassword", "password123");

    const result = await requestEmailChange(formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Something went wrong. Please try again.");
  });

  it("returns generic error when user not found in DB", async () => {
    tenantPrisma.user.findUnique.mockResolvedValueOnce(null);

    const formData = new FormData();
    formData.set("newEmail", "new@example.com");
    formData.set("currentPassword", "password123");

    const result = await requestEmailChange(formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Something went wrong. Please try again.");
  });

  it("returns generic error when user has no passwordHash", async () => {
    tenantPrisma.user.findUnique.mockResolvedValueOnce({
      email: "test@example.com",
      passwordHash: null,
      name: "Test User",
    });

    const formData = new FormData();
    formData.set("newEmail", "new@example.com");
    formData.set("currentPassword", "password123");

    const result = await requestEmailChange(formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Something went wrong. Please try again.");
  });

  it("returns validation error for invalid email format", async () => {
    const formData = new FormData();
    formData.set("newEmail", "not-an-email");
    formData.set("currentPassword", "password123");

    const result = await requestEmailChange(formData);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("returns validation error for empty current password", async () => {
    const formData = new FormData();
    formData.set("newEmail", "new@example.com");
    formData.set("currentPassword", "");

    const result = await requestEmailChange(formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Current password is required");
  });

  it("still returns success if Inngest dispatch fails (failure-isolated)", async () => {
    const { logger } = await import("@/lib/logger");
    vi.mocked(inngest.send).mockRejectedValueOnce(new Error("Inngest down"));

    const formData = new FormData();
    formData.set("newEmail", "new@example.com");
    formData.set("currentPassword", "password123");

    const result = await requestEmailChange(formData);

    // Should still return success — token was created in DB
    expect(result.success).toBe(true);
    // Should log the error
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to dispatch email change verification via Inngest",
      expect.objectContaining({
        userId: "user-1",
      }),
    );
  });

  it("returns generic error when transaction throws", async () => {
    unscopedPrisma.$transaction.mockRejectedValueOnce(new Error("DB connection lost"));

    const formData = new FormData();
    formData.set("newEmail", "new@example.com");
    formData.set("currentPassword", "password123");

    const result = await requestEmailChange(formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Something went wrong. Please try again.");
  });

  it("returns success (enumeration prevention) when unique constraint violation on pendingEmail", async () => {
    // Simulate Prisma P2002 unique constraint violation — race condition where
    // another user's transaction committed the same pendingEmail first (R4-H1)
    const p2002Error = new Error("Unique constraint failed on the fields: (`pending_email`)");
    Object.assign(p2002Error, { code: "P2002" });
    unscopedPrisma.$transaction.mockRejectedValueOnce(p2002Error);

    const formData = new FormData();
    formData.set("newEmail", "new@example.com");
    formData.set("currentPassword", "password123");

    const result = await requestEmailChange(formData);

    // Should return same success message as enumeration prevention
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.warning).toBe(
        "Verification email sent. Your email will update after you verify.",
      );
    }
  });

  it("uses tenant-scoped client for user lookup and unscoped for transaction", async () => {
    const formData = new FormData();
    formData.set("newEmail", "new@example.com");
    formData.set("currentPassword", "password123");

    await requestEmailChange(formData);

    // Tenant-scoped for user lookup
    expect(createTenantScopedClient).toHaveBeenCalledWith("account-1");
    expect(tenantPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { email: true, passwordHash: true, name: true },
    });

    // Unscoped for transaction (uniqueness check + token creation happen inside)
    // Called once: check + token ops are inside the transaction (R3-H2 race condition fix)
    expect(withoutTenantScope).toHaveBeenCalledTimes(1);
    expect(unscopedPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// confirmEmailChange
// ---------------------------------------------------------------------------
describe("confirmEmailChange", () => {
  let mockPrisma: ReturnType<typeof createMockTenantPrisma>["mockPrisma"];
  let mockTx: ReturnType<typeof createMockTenantPrisma>["mockTx"];

  // Pre-compute a realistic base64url token and its SHA-256 hash
  const plaintextToken = "dGVzdC10b2tlbi1zZWN1cmUtYnl0ZXMtMzJjaGFycw";
  const hashedToken = crypto.createHash("sha256").update(plaintextToken).digest("hex");

  beforeEach(() => {
    vi.clearAllMocks();
    const mocks = createMockTenantPrisma();
    mockPrisma = mocks.mockPrisma;
    mockTx = mocks.mockTx;
    vi.mocked(withoutTenantScope).mockReturnValue(mockPrisma as never);

    // Default: valid token record and matching user
    mockPrisma.verificationToken.findUnique.mockResolvedValue({
      identifier: "new@example.com",
      token: hashedToken,
      expires: new Date(Date.now() + 3600000), // 1h from now
    });

    mockPrisma.user.findFirst.mockResolvedValue({
      id: "user-1",
      accountId: "account-1",
      email: "test@example.com",
      pendingEmail: "new@example.com",
    });
  });

  it("returns success when valid token provided", async () => {
    const result = await confirmEmailChange(plaintextToken);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.warning).toBe(
        "Email updated successfully. Please log in with your new email.",
      );
    }
  });

  it("returns error for expired token", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "new@example.com",
      token: hashedToken,
      expires: new Date(Date.now() - 1000), // Expired 1s ago
    });

    const result = await confirmEmailChange(plaintextToken);

    expect(result.success).toBe(false);
    expect(result.error).toBe("This verification link is invalid or has expired.");

    // Expired token should be cleaned up
    expect(mockPrisma.verificationToken.delete).toHaveBeenCalledWith({
      where: {
        identifier_token: {
          identifier: "new@example.com",
          token: hashedToken,
        },
      },
    });
  });

  it("returns error for invalid/unknown token (not found in DB)", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce(null);

    const result = await confirmEmailChange(plaintextToken);

    expect(result.success).toBe(false);
    expect(result.error).toBe("This verification link is invalid or has expired.");
  });

  it("returns error for malformed token format (too short)", async () => {
    const result = await confirmEmailChange("short");

    expect(result.success).toBe(false);
    expect(result.error).toBe("This verification link is invalid or has expired.");
    // Should not hit DB
    expect(mockPrisma.verificationToken.findUnique).not.toHaveBeenCalled();
  });

  it("returns error for empty token", async () => {
    const result = await confirmEmailChange("");

    expect(result.success).toBe(false);
    expect(result.error).toBe("This verification link is invalid or has expired.");
    expect(mockPrisma.verificationToken.findUnique).not.toHaveBeenCalled();
  });

  it("returns error for token with invalid characters", async () => {
    const result = await confirmEmailChange("abc!@#$%^&*()+={}[]|\\:\"<>?,./~`");

    expect(result.success).toBe(false);
    expect(result.error).toBe("This verification link is invalid or has expired.");
    expect(mockPrisma.verificationToken.findUnique).not.toHaveBeenCalled();
  });

  it("returns error when no user has matching pendingEmail", async () => {
    mockPrisma.user.findFirst.mockResolvedValueOnce(null);

    const result = await confirmEmailChange(plaintextToken);

    expect(result.success).toBe(false);
    expect(result.error).toBe("This verification link is invalid or has expired.");
  });

  it("updates user email to pendingEmail value", async () => {
    await confirmEmailChange(plaintextToken);

    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({
        email: "new@example.com",
      }),
    });
  });

  it("clears pendingEmail field after confirmation", async () => {
    await confirmEmailChange(plaintextToken);

    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({
        pendingEmail: null,
      }),
    });
  });

  it("sets emailVerified timestamp", async () => {
    await confirmEmailChange(plaintextToken);

    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({
        emailVerified: expect.any(Date),
      }),
    });
  });

  it("deletes VerificationToken after use", async () => {
    await confirmEmailChange(plaintextToken);

    expect(mockTx.verificationToken.delete).toHaveBeenCalledWith({
      where: {
        identifier_token: {
          identifier: "new@example.com",
          token: hashedToken,
        },
      },
    });
  });

  it("destroys existing sessions (force re-login)", async () => {
    mockTx.session.deleteMany.mockResolvedValueOnce({ count: 2 });

    await confirmEmailChange(plaintextToken);

    expect(mockTx.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
  });

  it("logs warning when zero sessions destroyed (stale session state)", async () => {
    const { logger } = await import("@/lib/logger");
    mockTx.session.deleteMany.mockResolvedValueOnce({ count: 0 });

    await confirmEmailChange(plaintextToken);

    expect(logger.warn).toHaveBeenCalledWith(
      "Email change confirmed but zero sessions destroyed — possible stale session state",
      expect.objectContaining({ userId: "user-1" }),
    );
  });

  it("does not log warning when sessions are successfully destroyed", async () => {
    const { logger } = await import("@/lib/logger");
    mockTx.session.deleteMany.mockResolvedValueOnce({ count: 1 });

    await confirmEmailChange(plaintextToken);

    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining("zero sessions destroyed"),
      expect.anything(),
    );
  });

  it("creates SETTINGS_UPDATED event in transaction", async () => {
    await confirmEmailChange(plaintextToken);

    expect(mockTx.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "SETTINGS_UPDATED",
        actorType: "USER",
        actorId: "user-1",
        targetType: "User",
        targetId: "user-1",
        accountId: "account-1",
        payload: { field: "email_confirmed", userId: "user-1" },
      }),
    });
  });

  it("all confirmation operations happen in a single transaction", async () => {
    await confirmEmailChange(plaintextToken);

    // Verify that $transaction was called exactly once
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

    // Inside the transaction: user.update, verificationToken.delete,
    // session.deleteMany, event.create
    expect(mockTx.user.update).toHaveBeenCalledTimes(1);
    expect(mockTx.verificationToken.delete).toHaveBeenCalledTimes(1);
    expect(mockTx.session.deleteMany).toHaveBeenCalledTimes(1);
    expect(mockTx.event.create).toHaveBeenCalledTimes(1);
  });

  it("returns rate limit error when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 60 });

    const result = await confirmEmailChange(plaintextToken);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Too many attempts");
    expect(result.error).toContain("60 seconds");
  });

  it("rate limit check happens BEFORE any DB access", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 60 });

    await confirmEmailChange(plaintextToken);

    expect(mockPrisma.verificationToken.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("uses withoutTenantScope (no session required)", async () => {
    await confirmEmailChange(plaintextToken);

    expect(withoutTenantScope).toHaveBeenCalled();
    // Should NOT use createTenantScopedClient or auth
    expect(createTenantScopedClient).not.toHaveBeenCalled();
  });

  it("returns generic error when transaction throws", async () => {
    mockPrisma.$transaction.mockRejectedValueOnce(new Error("DB connection lost"));

    const result = await confirmEmailChange(plaintextToken);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Something went wrong. Please try again.");
  });

  it("logs warning when expired token deletion fails (concurrent cleanup)", async () => {
    const { logger } = await import("@/lib/logger");
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "new@example.com",
      token: hashedToken,
      expires: new Date(Date.now() - 1000), // Expired
    });
    // Simulate concurrent deletion — token already deleted by another request
    mockPrisma.verificationToken.delete.mockRejectedValueOnce(
      new Error("Record to delete does not exist"),
    );

    const result = await confirmEmailChange(plaintextToken);

    expect(result.success).toBe(false);
    expect(result.error).toBe("This verification link is invalid or has expired.");
    // The .catch() handler should log a warning, not throw
    expect(logger.warn).toHaveBeenCalledWith(
      "Failed to delete expired email change token — stale row remains",
      expect.objectContaining({
        identifier: expect.any(String),
      }),
    );
  });

  it("hashes the incoming token with SHA-256 before DB lookup", async () => {
    await confirmEmailChange(plaintextToken);

    // The findUnique should use the hashed token, not the plaintext
    expect(mockPrisma.verificationToken.findUnique).toHaveBeenCalledWith({
      where: { token: hashedToken },
    });
  });

  it("finds user by pendingEmail matching token identifier", async () => {
    await confirmEmailChange(plaintextToken);

    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: { pendingEmail: "new@example.com" },
    });
  });
});

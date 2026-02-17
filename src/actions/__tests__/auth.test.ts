import crypto from "crypto";

import bcrypt from "bcrypt";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies BEFORE importing the module under test
vi.mock("@/lib/db", () => ({
  withoutTenantScope: vi.fn(),
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

const { mockCookieStore, mockCheckRateLimit, mockGetClientIp } = vi.hoisted(() => {
  const mockCookieStore = {
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  };
  const mockCheckRateLimit = vi.fn().mockResolvedValue({ allowed: true });
  const mockGetClientIp = vi.fn().mockReturnValue("127.0.0.1");
  return { mockCookieStore, mockCheckRateLimit, mockGetClientIp };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
  headers: vi.fn().mockResolvedValue(new Headers({ "x-forwarded-for": "127.0.0.1" })),
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getClientIp: mockGetClientIp,
  loginLimiter: {},
  registerLimiter: {},
  verifyEmailLimiter: {},
  requestResetLimiter: {},
  resetPasswordLimiter: {},
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXTAUTH_URL: "http://localhost:3001",
    NEXTAUTH_SECRET: "test-secret",
    DATABASE_URL: "postgresql://test",
    NODE_ENV: "test",
  },
}));

import { registerUser, verifyEmail, resendVerification, loginUser, logoutUser, requestPasswordReset, resetPassword } from "@/actions/auth";
import { withoutTenantScope } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";

// Helper to create mock Prisma transaction client
function createMockPrisma() {
  const mockTx = {
    account: {
      create: vi.fn().mockResolvedValue({ id: "account-1", name: "Test User" }),
    },
    user: {
      create: vi.fn().mockResolvedValue({
        id: "user-1",
        accountId: "account-1",
        email: "test@example.com",
        name: "Test User",
      }),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ id: "user-1", emailVerified: new Date() }),
    },
    verificationToken: {
      create: vi.fn().mockResolvedValue({
        identifier: "test@example.com",
        token: "dGVzdC10b2tlbi1zZWN1cmUtYnl0ZXMtMzJjaGFycyEh",
        expires: new Date(Date.now() + 86400000),
      }),
      findUnique: vi.fn(),
      delete: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    event: {
      create: vi.fn().mockResolvedValue({ id: "event-1" }),
    },
    session: {
      create: vi.fn().mockResolvedValue({
        id: "session-1",
        sessionToken: "mock-session-token",
        userId: "user-1",
        accountId: "account-1",
        expires: new Date(Date.now() + 86400000),
      }),
      delete: vi.fn().mockResolvedValue({}),
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

describe("registerUser", () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>["mockPrisma"];
  let mockTx: ReturnType<typeof createMockPrisma>["mockTx"];

  beforeEach(() => {
    vi.clearAllMocks();
    const mocks = createMockPrisma();
    mockPrisma = mocks.mockPrisma;
    mockTx = mocks.mockTx;
    vi.mocked(withoutTenantScope).mockReturnValue(mockPrisma as never);
    vi.spyOn(crypto, "randomBytes").mockReturnValue(Buffer.from("test-token-secure-bytes-32chars!!") as never);
  });

  it("registers a user successfully", async () => {
    const result = await registerUser({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ email: "test@example.com" });
    expect(result.warning).toBeUndefined();

    // Verify bcrypt hash was called with 12 rounds
    expect(bcrypt.hash).toHaveBeenCalledWith("password123", 12);

    // Verify transaction created Account, User, VerificationToken, Event
    expect(mockTx.account.create).toHaveBeenCalledWith({
      data: { name: "Test User" },
    });
    expect(mockTx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: "account-1",
        email: "test@example.com",
        name: "Test User",
        passwordHash: "$2b$12$mockedhashedpassword",
      }),
    });
    expect(mockTx.verificationToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        identifier: "test@example.com",
        token: "dGVzdC10b2tlbi1zZWN1cmUtYnl0ZXMtMzJjaGFycyEh",
      }),
    });
    expect(mockTx.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "USER_JOINED",
        actorType: "USER",
        actorId: "user-1",
        targetType: "User",
        targetId: "user-1",
        accountId: "account-1",
      }),
    });

    // Verify Inngest event dispatched AFTER transaction
    expect(inngest.send).toHaveBeenCalledWith({
      name: "auth/verification.requested",
      data: {
        email: "test@example.com",
        name: "Test User",
        token: "dGVzdC10b2tlbi1zZWN1cmUtYnl0ZXMtMzJjaGFycyEh",
      },
    });
  });

  it("returns error for duplicate email", async () => {
    mockTx.user.findUnique.mockResolvedValueOnce({
      id: "existing-user",
      email: "test@example.com",
    });

    const result = await registerUser({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Email already registered");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns validation errors for invalid input", async () => {
    const result = await registerUser({
      name: "",
      email: "not-an-email",
      password: "short",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("hashes password with exactly 12 bcrypt salt rounds (AC1)", async () => {
    await registerUser({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });

    // Verify bcrypt.hash is called exactly once with 12 rounds (AC1 requirement)
    expect(bcrypt.hash).toHaveBeenCalledTimes(1);
    expect(bcrypt.hash).toHaveBeenCalledWith("password123", 12);

    // Verify the hashed result is stored in the database, not the plaintext password
    expect(mockTx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash: "$2b$12$mockedhashedpassword",
        }),
      }),
    );
    // Ensure plaintext password is NOT stored
    expect(mockTx.user.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash: "password123",
        }),
      }),
    );
  });

  it("trims and lowercases email before processing", async () => {
    await registerUser({
      name: "Test",
      email: "  USER@EXAMPLE.COM  ",
      password: "password123",
    });

    // The email uniqueness check should use the cleaned email
    expect(mockTx.user.findUnique).toHaveBeenCalledWith({
      where: { email: "user@example.com" },
    });
  });

  it("returns user-friendly error on concurrent duplicate email (race condition R3-H3)", async () => {
    // Simulate: findUnique returns null (no user found), but then user.create
    // fails with Prisma P2002 unique constraint violation (concurrent insert)
    const p2002Error = new Error("Unique constraint failed on the fields: (`email`)");
    Object.assign(p2002Error, { code: "P2002" });
    mockTx.user.create.mockRejectedValueOnce(p2002Error);

    const result = await registerUser({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Email already registered");
  });

  it("returns success with warning if Inngest dispatch fails (R2-H2, R4-M3)", async () => {
    const { logger } = await import("@/lib/logger");
    vi.mocked(inngest.send).mockRejectedValueOnce(new Error("Inngest connection failed"));

    const result = await registerUser({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });

    // Should still return success — account is created
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ email: "test@example.com" });

    // Should include a warning about the email dispatch failure (R4-M3)
    expect(result.warning).toBeDefined();
    expect(result.warning).toContain("trouble sending");

    // Should log the Inngest failure
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to dispatch verification email via Inngest",
      expect.objectContaining({
        email: "test@example.com",
        error: "Inngest connection failed",
      }),
    );
  });

  it("returns rate limit error when rate limit exceeded", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 30 });

    const result = await registerUser({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Too many attempts");
    expect(result.error).toContain("30 seconds");
  });

  it("proceeds normally when rate limit allows", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: true });

    const result = await registerUser({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });

    expect(result.success).toBe(true);
  });

  it("rate limit check happens BEFORE any DB access", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 30 });

    await registerUser({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });

    // DB should never be accessed when rate-limited
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("verifyEmail", () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>["mockPrisma"];
  let mockTx: ReturnType<typeof createMockPrisma>["mockTx"];

  beforeEach(() => {
    vi.clearAllMocks();
    const mocks = createMockPrisma();
    mockPrisma = mocks.mockPrisma;
    mockTx = mocks.mockTx;
    vi.mocked(withoutTenantScope).mockReturnValue(mockPrisma as never);
  });

  it("verifies email successfully with valid token", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "test@example.com",
      token: "valid-token",
      expires: new Date(Date.now() + 86400000), // 24h from now
    });
    mockTx.user.update.mockResolvedValueOnce({
      id: "user-1",
      accountId: "account-1",
      emailVerified: new Date(),
    });

    const result = await verifyEmail("valid-token");

    expect(result.success).toBe(true);
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { email: "test@example.com" },
      data: { emailVerified: expect.any(Date) },
    });
    expect(mockTx.verificationToken.delete).toHaveBeenCalledWith({
      where: {
        identifier_token: {
          identifier: "test@example.com",
          token: "valid-token",
        },
      },
    });
    // Verify audit event created for email verification (R3-M4)
    expect(mockTx.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "USER_EMAIL_VERIFIED",
        actorType: "USER",
        actorId: "user-1",
        targetType: "User",
        targetId: "user-1",
        accountId: "account-1",
      }),
    });
  });

  it("returns error for expired token and deletes it (R3-M2)", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "test@example.com",
      token: "expired-token",
      expires: new Date(Date.now() - 1000), // Expired 1s ago
    });

    const result = await verifyEmail("expired-token");

    expect(result.success).toBe(false);
    expect(result.error).toContain("expired");
    // Verify expired token is deleted to prevent timing-based attacks
    expect(mockPrisma.verificationToken.delete).toHaveBeenCalledWith({
      where: {
        identifier_token: {
          identifier: "test@example.com",
          token: "expired-token",
        },
      },
    });
  });

  it("returns error for non-existent token", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce(null);

    const result = await verifyEmail("non-existent-token");

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("logs warning when concurrent expired token deletion fails (R5-L3)", async () => {
    const { logger } = await import("@/lib/logger");
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "test@example.com",
      token: "expired-token",
      expires: new Date(Date.now() - 1000), // Expired
    });
    // Simulate concurrent deletion — token already deleted by another request
    mockPrisma.verificationToken.delete.mockRejectedValueOnce(
      new Error("Record to delete does not exist"),
    );

    const result = await verifyEmail("expired-token");

    expect(result.success).toBe(false);
    expect(result.error).toContain("expired");
    // The .catch() handler should log a warning, not throw
    expect(logger.warn).toHaveBeenCalledWith(
      "Failed to delete expired verification token",
      expect.objectContaining({ identifier: "test@example.com" }),
    );
  });

  it("returns rate limit error when rate limit exceeded", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 60 });

    const result = await verifyEmail("valid-token");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Too many attempts");
  });

  it("proceeds normally when rate limit allows", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: true });
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "test@example.com",
      token: "valid-token",
      expires: new Date(Date.now() + 86400000),
    });
    mockTx.user.update.mockResolvedValueOnce({
      id: "user-1",
      accountId: "account-1",
      emailVerified: new Date(),
    });

    const result = await verifyEmail("valid-token");

    expect(result.success).toBe(true);
  });

  it("rate limit check happens BEFORE any DB access", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 60 });

    await verifyEmail("valid-token");

    expect(mockPrisma.verificationToken.findUnique).not.toHaveBeenCalled();
  });
});

describe("resendVerification", () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>["mockPrisma"];

  beforeEach(() => {
    vi.clearAllMocks();
    const mocks = createMockPrisma();
    mockPrisma = mocks.mockPrisma;
    vi.mocked(withoutTenantScope).mockReturnValue(mockPrisma as never);
    vi.spyOn(crypto, "randomBytes").mockReturnValue(Buffer.from("new-token-secure-bytes-32chars!!") as never);
  });

  it("resends verification for unverified user", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "test@example.com",
      emailVerified: null,
      name: "Test User",
    });

    const result = await resendVerification({ email: "test@example.com" });

    expect(result.success).toBe(true);
    // Verify deletion + creation wrapped in a transaction (R2-H3 fix)
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: "test@example.com" },
    });
    expect(mockPrisma.verificationToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        identifier: "test@example.com",
        token: "bmV3LXRva2VuLXNlY3VyZS1ieXRlcy0zMmNoYXJzISE",
      }),
    });
    expect(inngest.send).toHaveBeenCalledWith({
      name: "auth/verification.requested",
      data: {
        email: "test@example.com",
        name: "Test User",
        token: "bmV3LXRva2VuLXNlY3VyZS1ieXRlcy0zMmNoYXJzISE",
      },
    });
  });

  it("returns success even if user not found (prevent email enumeration)", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const result = await resendVerification({ email: "nonexistent@example.com" });

    // Should still return success to prevent email enumeration
    expect(result.success).toBe(true);
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it("returns success for already verified user (prevent email enumeration)", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "test@example.com",
      emailVerified: new Date(),
      name: "Test User",
    });

    const result = await resendVerification({ email: "test@example.com" });

    expect(result.success).toBe(true);
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it("returns success even if Inngest dispatch fails (R3-M5)", async () => {
    const { logger } = await import("@/lib/logger");
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "test@example.com",
      emailVerified: null,
      name: "Test User",
    });
    vi.mocked(inngest.send).mockRejectedValueOnce(new Error("Inngest connection failed"));

    const result = await resendVerification({ email: "test@example.com" });

    // Should still return success — token is created in DB
    expect(result.success).toBe(true);

    // Should log the Inngest failure
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to dispatch resend verification email via Inngest",
      expect.objectContaining({
        email: "test@example.com",
        userId: "user-1",
        error: "Inngest connection failed",
      }),
    );
  });

  it("returns error for invalid email format", async () => {
    const result = await resendVerification({ email: "not-valid" });

    expect(result.success).toBe(false);
  });

  it("returns rate limit error when rate limit exceeded", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 60 });

    const result = await resendVerification({ email: "test@example.com" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Too many attempts");
    expect(result.error).toContain("60 seconds");
  });

  it("proceeds normally when rate limit allows", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: true });
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const result = await resendVerification({ email: "test@example.com" });

    expect(result.success).toBe(true);
  });

  it("rate limit check happens BEFORE any DB access", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 60 });

    await resendVerification({ email: "test@example.com" });

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("loginUser", () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>["mockPrisma"];

  beforeEach(() => {
    vi.clearAllMocks();
    const mocks = createMockPrisma();
    mockPrisma = mocks.mockPrisma;
    vi.mocked(withoutTenantScope).mockReturnValue(mockPrisma as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    mockCookieStore.set.mockReturnValue(undefined);
    mockCookieStore.get.mockReturnValue(undefined);
    mockCookieStore.delete.mockReturnValue(undefined);
  });

  it("logs in successfully with correct credentials (AC1)", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      accountId: "account-1",
      email: "test@example.com",
      name: "Test User",
      emailVerified: new Date(),
      passwordHash: "$2b$12$mockedhashedpassword",
    });

    const result = await loginUser({
      email: "test@example.com",
      password: "password123",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ redirectTo: "/dashboard" });
    }

    // Verify session was created
    expect(mockPrisma.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        accountId: "account-1",
        sessionToken: expect.any(String),
        expires: expect.any(Date),
      }),
    });

    // Verify session cookie was set
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "authjs.session-token",
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
      }),
    );
  });

  it("returns generic error for wrong password (AC2)", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      accountId: "account-1",
      email: "test@example.com",
      emailVerified: new Date(),
      passwordHash: "$2b$12$mockedhashedpassword",
    });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);

    const result = await loginUser({
      email: "test@example.com",
      password: "wrongpassword",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid email or password");
    expect(mockPrisma.session.create).not.toHaveBeenCalled();
  });

  it("returns generic error for nonexistent user — same message as wrong password (AC2)", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const result = await loginUser({
      email: "nonexistent@example.com",
      password: "password123",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid email or password");
    expect(mockPrisma.session.create).not.toHaveBeenCalled();
  });

  it("returns EMAIL_NOT_VERIFIED error for unverified email (AC3)", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      accountId: "account-1",
      email: "test@example.com",
      emailVerified: null,
      passwordHash: "$2b$12$mockedhashedpassword",
    });

    const result = await loginUser({
      email: "test@example.com",
      password: "password123",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("EMAIL_NOT_VERIFIED");
    expect(mockPrisma.session.create).not.toHaveBeenCalled();
  });

  it("returns generic error for user with no passwordHash (OAuth-only user)", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      accountId: "account-1",
      email: "test@example.com",
      emailVerified: new Date(),
      passwordHash: null,
    });

    const result = await loginUser({
      email: "test@example.com",
      password: "password123",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid email or password");
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it("returns validation error for invalid input", async () => {
    const result = await loginUser({
      email: "not-an-email",
      password: "",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("cleans up existing sessions before creating a new one (concurrent login)", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      accountId: "account-1",
      email: "test@example.com",
      name: "Test User",
      emailVerified: new Date(),
      passwordHash: "$2b$12$mockedhashedpassword",
    });

    await loginUser({
      email: "test@example.com",
      password: "password123",
    });

    // Verify old sessions are deleted before new session is created
    expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    // deleteMany should be called before create
    const deleteManyOrder = mockPrisma.session.deleteMany.mock.invocationCallOrder[0];
    const createOrder = mockPrisma.session.create.mock.invocationCallOrder[0];
    expect(deleteManyOrder).toBeLessThan(createOrder);
  });

  it("still creates session if existing session cleanup fails (non-critical)", async () => {
    const { logger } = await import("@/lib/logger");
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      accountId: "account-1",
      email: "test@example.com",
      name: "Test User",
      emailVerified: new Date(),
      passwordHash: "$2b$12$mockedhashedpassword",
    });
    mockPrisma.session.deleteMany.mockRejectedValueOnce(new Error("DB error"));

    const result = await loginUser({
      email: "test@example.com",
      password: "password123",
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.session.create).toHaveBeenCalled();
    // Verify warning includes masked email for correlation (R4-M1)
    expect(logger.warn).toHaveBeenCalledWith(
      "Failed to clean up existing sessions during login",
      expect.objectContaining({ userId: "user-1", email: "t***@example.com" }),
    );
  });

  it("returns error when user has no accountId (data corruption guard)", async () => {
    const { logger } = await import("@/lib/logger");
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      accountId: null,
      email: "test@example.com",
      emailVerified: new Date(),
      passwordHash: "$2b$12$mockedhashedpassword",
    });

    const result = await loginUser({
      email: "test@example.com",
      password: "password123",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Login failed. Please try again.");
    expect(mockPrisma.session.create).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      "User missing accountId during login",
      expect.objectContaining({ userId: "user-1", email: "t***@example.com" }),
    );
  });

  it("returns rate limit error when rate limit exceeded", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 30 });

    const result = await loginUser({
      email: "test@example.com",
      password: "password123",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Too many attempts");
    expect(result.error).toContain("30 seconds");
  });

  it("proceeds normally when rate limit allows", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: true });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      accountId: "account-1",
      email: "test@example.com",
      name: "Test User",
      emailVerified: new Date(),
      passwordHash: "$2b$12$mockedhashedpassword",
    });

    const result = await loginUser({
      email: "test@example.com",
      password: "password123",
    });

    expect(result.success).toBe(true);
  });

  it("rate limit check happens BEFORE any DB access (verify DB mock not called when rate-limited)", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 30 });

    await loginUser({
      email: "test@example.com",
      password: "password123",
    });

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.session.create).not.toHaveBeenCalled();
  });
});

describe("logoutUser", () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>["mockPrisma"];

  // Use a realistic base64url-encoded token (43 chars, matching 32-byte randomBytes output)
  const mockSessionToken = "dGVzdC1zZXNzaW9uLXRva2VuLWZvci1sb2dvdXQtQUI";

  beforeEach(() => {
    vi.clearAllMocks();
    const mocks = createMockPrisma();
    mockPrisma = mocks.mockPrisma;
    vi.mocked(withoutTenantScope).mockReturnValue(mockPrisma as never);
    mockCookieStore.set.mockReturnValue(undefined);
    mockCookieStore.get.mockReturnValue({ value: mockSessionToken });
    mockCookieStore.delete.mockReturnValue(undefined);
  });

  it("logs out successfully — deletes session and clears cookie (AC4)", async () => {
    const result = await logoutUser();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ redirectTo: "/login" });
    }

    // Verify session was deleted
    expect(mockPrisma.session.delete).toHaveBeenCalledWith({
      where: { sessionToken: mockSessionToken },
    });

    // Verify cookie was cleared
    expect(mockCookieStore.delete).toHaveBeenCalledWith({
      name: "authjs.session-token",
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });
  });

  it("handles gracefully when session already expired/deleted", async () => {
    mockPrisma.session.delete.mockRejectedValueOnce(
      new Error("Record to delete does not exist"),
    );

    const result = await logoutUser();

    // Should still return success — cookie is cleared regardless
    expect(result.success).toBe(true);
    expect(mockCookieStore.delete).toHaveBeenCalledWith({
      name: "authjs.session-token",
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });
  });

  it("skips DB delete for malformed session token (too short)", async () => {
    const { logger } = await import("@/lib/logger");
    mockCookieStore.get.mockReturnValueOnce({ value: "bad" });

    const result = await logoutUser();

    expect(result.success).toBe(true);
    // Should NOT attempt DB delete with malformed token
    expect(mockPrisma.session.delete).not.toHaveBeenCalled();
    // Should log warning about malformed token
    expect(logger.warn).toHaveBeenCalledWith(
      "Malformed session token during logout",
      expect.objectContaining({ tokenLength: 3 }),
    );
    // Cookie should still be cleared
    expect(mockCookieStore.delete).toHaveBeenCalledWith({
      name: "authjs.session-token",
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });
  });

  it("skips DB delete for 19-char token (boundary: just under minimum)", async () => {
    const { logger } = await import("@/lib/logger");
    mockCookieStore.get.mockReturnValueOnce({ value: "abcdefghij123456789" }); // 19 chars

    const result = await logoutUser();

    expect(result.success).toBe(true);
    expect(mockPrisma.session.delete).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "Malformed session token during logout",
      expect.objectContaining({ tokenLength: 19 }),
    );
  });

  it("accepts 20-char token (boundary: exactly minimum length)", async () => {
    mockCookieStore.get.mockReturnValueOnce({ value: "abcdefghij1234567890" }); // 20 chars

    const result = await logoutUser();

    expect(result.success).toBe(true);
    // Should attempt DB delete — 20 chars passes the regex /^[\w-]{20,}$/
    expect(mockPrisma.session.delete).toHaveBeenCalledWith({
      where: { sessionToken: "abcdefghij1234567890" },
    });
  });

  it("skips DB delete for token with invalid characters", async () => {
    const { logger } = await import("@/lib/logger");
    // 25 chars but contains # which is not a word char or hyphen
    mockCookieStore.get.mockReturnValueOnce({ value: "token-with-special-#-char" });

    const result = await logoutUser();

    expect(result.success).toBe(true);
    expect(mockPrisma.session.delete).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "Malformed session token during logout",
      expect.objectContaining({ tokenLength: 25 }),
    );
  });

  it("handles logout when no session cookie exists", async () => {
    mockCookieStore.get.mockReturnValueOnce(undefined);

    const result = await logoutUser();

    expect(result.success).toBe(true);
    // Session delete should NOT be called when no cookie
    expect(mockPrisma.session.delete).not.toHaveBeenCalled();
    // Cookie should still be cleared
    expect(mockCookieStore.delete).toHaveBeenCalledWith({
      name: "authjs.session-token",
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });
  });
});

describe("requestPasswordReset", () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>["mockPrisma"];

  beforeEach(() => {
    vi.clearAllMocks();
    const mocks = createMockPrisma();
    mockPrisma = mocks.mockPrisma;
    vi.mocked(withoutTenantScope).mockReturnValue(mockPrisma as never);
    vi.spyOn(crypto, "randomBytes").mockReturnValue(Buffer.from("test-token-secure-bytes-32chars!!") as never);
  });

  it("sends reset email for valid verified user (AC1)", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      accountId: "account-1",
      email: "test@example.com",
      name: "Test User",
      emailVerified: new Date(),
    });

    const result = await requestPasswordReset({ email: "test@example.com" });

    expect(result.success).toBe(true);
    expect(result.warning).toContain("If an account exists");

    // Token delete+create should be wrapped in $transaction (R5-M1)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

    // Token should be deleted then created inside the transaction
    expect(mockPrisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: "test@example.com" },
    });
    expect(mockPrisma.verificationToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        identifier: "test@example.com",
        // Token should be SHA-256 hashed (64 hex chars), not the raw base64url
        token: expect.stringMatching(/^[a-f0-9]{64}$/),
        expires: expect.any(Date),
      }),
    });

    // Inngest should receive the PLAINTEXT token (not the hash)
    expect(inngest.send).toHaveBeenCalledWith({
      name: "auth/password-reset.requested",
      data: {
        email: "test@example.com",
        name: "Test User",
        token: "dGVzdC10b2tlbi1zZWN1cmUtYnl0ZXMtMzJjaGFycyEh",
      },
    });

    // Audit event should be created
    expect(mockPrisma.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "USER_PASSWORD_RESET_REQUESTED",
        actorType: "USER",
        actorId: "user-1",
        accountId: "account-1",
      }),
    });
  });

  it("returns success even if email not found — AC5 email enumeration prevention", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const result = await requestPasswordReset({ email: "nonexistent@example.com" });

    expect(result.success).toBe(true);
    // Should NOT send any email
    expect(inngest.send).not.toHaveBeenCalled();
    // Should NOT create a token
    expect(mockPrisma.verificationToken.create).not.toHaveBeenCalled();
  });

  it("returns success for unverified email — AC5", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      accountId: "account-1",
      email: "test@example.com",
      emailVerified: null,
    });

    const result = await requestPasswordReset({ email: "test@example.com" });

    expect(result.success).toBe(true);
    expect(inngest.send).not.toHaveBeenCalled();
    expect(mockPrisma.verificationToken.create).not.toHaveBeenCalled();
  });

  it("deletes existing tokens before creating new one — inside $transaction (R5-M1)", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      accountId: "account-1",
      email: "test@example.com",
      name: "Test User",
      emailVerified: new Date(),
    });

    await requestPasswordReset({ email: "test@example.com" });

    // Verify wrapped in $transaction (matches resendVerification pattern)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

    // deleteMany should be called before create
    const deleteManyOrder = mockPrisma.verificationToken.deleteMany.mock.invocationCallOrder[0];
    const createOrder = mockPrisma.verificationToken.create.mock.invocationCallOrder[0];
    expect(deleteManyOrder).toBeLessThan(createOrder);
  });

  it("returns validation error for invalid email format", async () => {
    const result = await requestPasswordReset({ email: "not-valid" });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("still returns success if Inngest dispatch fails (token is still in DB)", async () => {
    const { logger } = await import("@/lib/logger");
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      accountId: "account-1",
      email: "test@example.com",
      name: "Test User",
      emailVerified: new Date(),
    });
    vi.mocked(inngest.send).mockRejectedValueOnce(new Error("Inngest down"));

    const result = await requestPasswordReset({ email: "test@example.com" });

    // Should still return success — token was created
    expect(result.success).toBe(true);
    // Token should have been created in DB
    expect(mockPrisma.verificationToken.create).toHaveBeenCalled();
    // Should log the error with masked email only (no userId — PII correlation risk)
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to dispatch password reset email via Inngest",
      expect.objectContaining({
        email: "t***@example.com",
      }),
    );
    // Verify userId is NOT included in the log (R1-M5)
    const errorCalls = vi.mocked(logger.error).mock.calls;
    const inngestErrorCall = errorCalls.find(
      (call) => call[0] === "Failed to dispatch password reset email via Inngest",
    );
    expect(inngestErrorCall?.[1]).not.toHaveProperty("userId");
  });

  it("still returns success if audit event creation fails — failure-isolated (R5-L1)", async () => {
    const { logger } = await import("@/lib/logger");
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      accountId: "account-1",
      email: "test@example.com",
      name: "Test User",
      emailVerified: new Date(),
    });
    // Audit event creation fails after token is created and Inngest dispatched
    mockPrisma.event.create.mockRejectedValueOnce(new Error("DB connection lost"));

    const result = await requestPasswordReset({ email: "test@example.com" });

    // Should still return success — token was created and email dispatched
    expect(result.success).toBe(true);
    expect(result.warning).toContain("If an account exists");
    // Token should have been created in the transaction
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    // Inngest should have been dispatched
    expect(inngest.send).toHaveBeenCalled();
    // Error should be logged
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to create password reset audit event",
      expect.objectContaining({
        userId: "user-1",
        email: "t***@example.com",
        error: "DB connection lost",
      }),
    );
  });

  it("returns rate limit error when rate limit exceeded", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 30 });

    const result = await requestPasswordReset({ email: "test@example.com" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Too many attempts");
  });

  it("proceeds normally when rate limit allows", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: true });
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const result = await requestPasswordReset({ email: "test@example.com" });

    expect(result.success).toBe(true);
  });

  it("rate limit check happens BEFORE any DB access", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 30 });

    await requestPasswordReset({ email: "test@example.com" });

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("resetPassword", () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>["mockPrisma"];
  let mockTx: ReturnType<typeof createMockPrisma>["mockTx"];

  // Pre-compute the SHA-256 hash of a realistic base64url token for test setup.
  // Real tokens are 43-char base64url-encoded 32-byte random values.
  const plaintextToken = "dGVzdC10b2tlbi1zZWN1cmUtYnl0ZXMtMzJjaGFycw";
  const hashedToken = crypto.createHash("sha256").update(plaintextToken).digest("hex");

  beforeEach(() => {
    vi.clearAllMocks();
    const mocks = createMockPrisma();
    mockPrisma = mocks.mockPrisma;
    mockTx = mocks.mockTx;
    vi.mocked(withoutTenantScope).mockReturnValue(mockPrisma as never);
    vi.mocked(bcrypt.hash).mockResolvedValue("$2b$12$newhashedpassword" as never);
  });

  it("resets password successfully (AC3)", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "test@example.com",
      token: hashedToken,
      expires: new Date(Date.now() + 86400000), // 24h from now
    });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      accountId: "account-1",
      email: "test@example.com",
    });

    const result = await resetPassword({
      token: plaintextToken,
      password: "newpassword123",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ redirectTo: "/login?reset=true" });
    }

    // Verify all operations happened inside a transaction
    expect(mockPrisma.$transaction).toHaveBeenCalled();

    // Password update
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { passwordHash: "$2b$12$newhashedpassword" },
    });

    // Token deleted (single-use)
    expect(mockTx.verificationToken.delete).toHaveBeenCalledWith({
      where: {
        identifier_token: {
          identifier: "test@example.com",
          token: hashedToken,
        },
      },
    });

    // All sessions destroyed
    expect(mockTx.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });

    // Audit event created
    expect(mockTx.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "USER_PASSWORD_RESET_COMPLETED",
        actorType: "USER",
        actorId: "user-1",
        accountId: "account-1",
      }),
    });
  });

  it("returns error for invalid token (not found in DB)", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce(null);

    // Use a validly-formatted token that simply doesn't exist in the DB
    const result = await resetPassword({
      token: "YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NQ",
      password: "newpassword123",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("invalid");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns error for malformed token format without hitting DB (R1-H5)", async () => {
    // Tokens that are too short, too long, or contain invalid characters
    // should be rejected before any crypto or DB operations
    const malformedTokens = [
      "short",                    // too short
      "a".repeat(60),             // too long
      "abc!@#$%^&*()+={}[]|\\:\"", // invalid characters
      "",                          // empty
    ];

    for (const token of malformedTokens) {
      const result = await resetPassword({
        token,
        password: "newpassword123",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("invalid");
    }

    // No DB lookups should have been made for malformed tokens
    expect(mockPrisma.verificationToken.findUnique).not.toHaveBeenCalled();
  });

  it("returns same generic error for expired token as for invalid — prevents info leakage (see auth.ts token expiry security comment)", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "test@example.com",
      token: hashedToken,
      expires: new Date(Date.now() - 1000), // Expired 1s ago
    });

    const result = await resetPassword({
      token: plaintextToken,
      password: "newpassword123",
    });

    expect(result.success).toBe(false);
    // R2-M3: Uses same error as invalid token to prevent attackers from
    // distinguishing "token existed but expired" vs "token never existed"
    expect(result.error).toContain("invalid");
    // Expired token should be deleted
    expect(mockPrisma.verificationToken.delete).toHaveBeenCalledWith({
      where: {
        identifier_token: {
          identifier: "test@example.com",
          token: hashedToken,
        },
      },
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns validation error for password too short", async () => {
    const result = await resetPassword({
      token: plaintextToken,
      password: "short",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("8 characters");
  });

  it("returns generic error if user not found for token email", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "orphaned@example.com",
      token: hashedToken,
      expires: new Date(Date.now() + 86400000),
    });
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const result = await resetPassword({
      token: plaintextToken,
      password: "newpassword123",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("failed");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns error when user has no accountId — data corruption guard (R2-M2)", async () => {
    const { logger } = await import("@/lib/logger");
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "test@example.com",
      token: hashedToken,
      expires: new Date(Date.now() + 86400000),
    });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      accountId: null,
      email: "test@example.com",
    });

    const result = await resetPassword({
      token: plaintextToken,
      password: "newpassword123",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("failed");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      "User missing accountId during password reset",
      expect.objectContaining({ userId: "user-1", email: "t***@example.com" }),
    );
  });

  it("bcrypt.hash is called INSIDE the transaction callback (R2-H1 security fix)", async () => {
    // R2-H1: bcrypt.hash must be inside the transaction to prevent repeated
    // expensive bcrypt operations (12 rounds) if the transaction retries.
    // Verify by checking that bcrypt.hash is called AFTER $transaction starts
    // (i.e., during the callback, not before it).
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "test@example.com",
      token: hashedToken,
      expires: new Date(Date.now() + 86400000),
    });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      accountId: "account-1",
      email: "test@example.com",
    });

    // Track when bcrypt.hash is called relative to transaction operations
    let bcryptCalledInsideTransaction = false;
    vi.mocked(mockPrisma.$transaction).mockImplementationOnce(async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
      // Reset bcrypt.hash mock to track calls only within this callback
      vi.mocked(bcrypt.hash).mockClear();
      vi.mocked(bcrypt.hash).mockResolvedValue("$2b$12$newhashedpassword" as never);
      const result = await fn(mockTx);
      // If bcrypt.hash was called during fn(), it means it's inside the transaction
      bcryptCalledInsideTransaction = vi.mocked(bcrypt.hash).mock.calls.length > 0;
      return result;
    });

    await resetPassword({
      token: plaintextToken,
      password: "newpassword123",
    });

    expect(bcryptCalledInsideTransaction).toBe(true);
    expect(bcrypt.hash).toHaveBeenCalledWith("newpassword123", 12);
  });

  it("all operations are inside a single transaction (atomicity)", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "test@example.com",
      token: hashedToken,
      expires: new Date(Date.now() + 86400000),
    });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      accountId: "account-1",
      email: "test@example.com",
    });

    await resetPassword({
      token: plaintextToken,
      password: "newpassword123",
    });

    // Verify that $transaction was called exactly once
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

    // Inside the transaction: user.update, verificationToken.delete, session.deleteMany, event.create
    expect(mockTx.user.update).toHaveBeenCalledTimes(1);
    expect(mockTx.verificationToken.delete).toHaveBeenCalledTimes(1);
    expect(mockTx.session.deleteMany).toHaveBeenCalledTimes(1);
    expect(mockTx.event.create).toHaveBeenCalledTimes(1);
  });

  it("returns rate limit error when rate limit exceeded", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 30 });

    const result = await resetPassword({
      token: plaintextToken,
      password: "newpassword123",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Too many attempts");
  });

  it("proceeds normally when rate limit allows", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: true });
    mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
      identifier: "test@example.com",
      token: hashedToken,
      expires: new Date(Date.now() + 86400000),
    });
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      accountId: "account-1",
      email: "test@example.com",
    });

    const result = await resetPassword({
      token: plaintextToken,
      password: "newpassword123",
    });

    expect(result.success).toBe(true);
  });

  it("rate limit check happens BEFORE any DB access", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 30 });

    await resetPassword({
      token: plaintextToken,
      password: "newpassword123",
    });

    expect(mockPrisma.verificationToken.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { logger } from "@/lib/logger";
import {
  apiAccountLimiter,
  checkRateLimit,
  createRateLimiter,
  getClientIp,
  loginLimiter,
  normaliseIp,
  registerLimiter,
  requestResetLimiter,
  resetPasswordLimiter,
  verifyEmailLimiter,
} from "@/lib/rateLimit";

describe("getClientIp", () => {
  function makeHeaders(init: Record<string, string>): Headers {
    return new Headers(init);
  }

  it("extracts plain IPv4 from x-forwarded-for", () => {
    const h = makeHeaders({ "x-forwarded-for": "203.0.113.50" });
    expect(getClientIp(h)).toBe("203.0.113.50");
  });

  it("takes first IP from proxy chain (multiple IPs)", () => {
    const h = makeHeaders({ "x-forwarded-for": "203.0.113.50, 70.41.3.18, 150.172.238.178" });
    expect(getClientIp(h)).toBe("203.0.113.50");
  });

  it("passes through plain IPv6 from x-forwarded-for", () => {
    const h = makeHeaders({ "x-forwarded-for": "2001:db8::1" });
    expect(getClientIp(h)).toBe("2001:db8::1");
  });

  it("normalises IPv4-mapped IPv6 to IPv4", () => {
    const h = makeHeaders({ "x-forwarded-for": "::ffff:192.168.1.1" });
    expect(getClientIp(h)).toBe("192.168.1.1");
  });

  it("passes through IPv6 localhost (::1)", () => {
    const h = makeHeaders({ "x-forwarded-for": "::1" });
    expect(getClientIp(h)).toBe("::1");
  });

  it("falls back to x-real-ip when x-forwarded-for is missing", () => {
    const h = makeHeaders({ "x-real-ip": "10.0.0.1" });
    expect(getClientIp(h)).toBe("10.0.0.1");
  });

  it("falls back to 'unknown' when both headers are missing", () => {
    const h = makeHeaders({});
    expect(getClientIp(h)).toBe("unknown");
  });

  it("trims whitespace from IP addresses", () => {
    const h = makeHeaders({ "x-forwarded-for": "  203.0.113.50  , 70.41.3.18 " });
    expect(getClientIp(h)).toBe("203.0.113.50");
  });
});

describe("createRateLimiter", () => {
  it("returns a limiter instance", () => {
    const limiter = createRateLimiter({ points: 5, duration: 60, keyPrefix: "test" });
    expect(limiter).toBeDefined();
    expect(typeof limiter.consume).toBe("function");
  });

  it("respects points configuration", async () => {
    const limiter = createRateLimiter({ points: 2, duration: 60, keyPrefix: "test-points" });
    // First two calls should succeed
    const r1 = await checkRateLimit(limiter, "key1");
    const r2 = await checkRateLimit(limiter, "key1");
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    // Third call should be rate-limited
    const r3 = await checkRateLimit(limiter, "key1");
    expect(r3.allowed).toBe(false);
  });
});

describe("checkRateLimit", () => {
  let limiter: ReturnType<typeof createRateLimiter>;

  beforeEach(() => {
    // Fresh limiter per test to avoid cross-test contamination
    limiter = createRateLimiter({ points: 3, duration: 60, keyPrefix: `test-${Date.now()}` });
  });

  it("returns { allowed: true } when under limit", async () => {
    const result = await checkRateLimit(limiter, "test-key");
    expect(result).toEqual({ allowed: true });
  });

  it("returns { allowed: false, retryAfter: N } when limit exceeded", async () => {
    // Exhaust all points
    await checkRateLimit(limiter, "test-key");
    await checkRateLimit(limiter, "test-key");
    await checkRateLimit(limiter, "test-key");

    const result = await checkRateLimit(limiter, "test-key");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfter).toBeGreaterThan(0);
    }
  });

  it("retryAfter is a positive integer (ceiling-rounded seconds)", async () => {
    await checkRateLimit(limiter, "test-key");
    await checkRateLimit(limiter, "test-key");
    await checkRateLimit(limiter, "test-key");

    const result = await checkRateLimit(limiter, "test-key");
    if (!result.allowed) {
      expect(Number.isInteger(result.retryAfter)).toBe(true);
      expect(result.retryAfter).toBeGreaterThanOrEqual(1);
    }
  });

  it("limiter resets after duration window", async () => {
    // Use a limiter with very short duration for testing
    const shortLimiter = createRateLimiter({ points: 1, duration: 1, keyPrefix: `short-${Date.now()}` });

    await checkRateLimit(shortLimiter, "test-key");
    const limited = await checkRateLimit(shortLimiter, "test-key");
    expect(limited.allowed).toBe(false);

    // Wait for the window to expire (1500ms buffer to prevent flaky CI failures
    // on slow runners where JS event loop timing may cause delays)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const afterReset = await checkRateLimit(shortLimiter, "test-key");
    expect(afterReset.allowed).toBe(true);
  });

  it("logs warning and re-throws wrapped error with context on unexpected failure", async () => {
    // Create a limiter with a broken consume method to simulate unexpected failure
    const keyPrefix = `broken-${Date.now()}`;
    const brokenLimiter = createRateLimiter({ points: 3, duration: 60, keyPrefix });
    const originalError = new Error("memory exhaustion");
    vi.spyOn(brokenLimiter, "consume").mockRejectedValueOnce(originalError);

    await expect(checkRateLimit(brokenLimiter, "test-key")).rejects.toThrow(
      `Rate limit check failed for keyPrefix "${keyPrefix}": memory exhaustion`,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "Rate limiter unexpected error",
      expect.objectContaining({
        error: "memory exhaustion",
        keyPrefix,
        key: "test-key",
      }),
    );
  });

  it("correctly rate-limits concurrent requests (atomic consume)", async () => {
    // Limiter with 3 points: fire 5 concurrent requests
    const concurrentLimiter = createRateLimiter({
      points: 3,
      duration: 60,
      keyPrefix: `concurrent-${Date.now()}`,
    });

    const results = await Promise.all(
      Array.from({ length: 5 }, () => checkRateLimit(concurrentLimiter, "same-key")),
    );

    const allowed = results.filter((r) => r.allowed);
    const rejected = results.filter((r) => !r.allowed);

    // Exactly 3 should succeed (matching points config), rest should be rate-limited
    expect(allowed).toHaveLength(3);
    expect(rejected).toHaveLength(2);
    rejected.forEach((r) => {
      if (!r.allowed) {
        expect(r.retryAfter).toBeGreaterThanOrEqual(1);
      }
    });
  });

  it("still propagates error when logger.warn fails (failure-isolated logging)", async () => {
    const keyPrefix = `logger-fail-${Date.now()}`;
    const brokenLimiter = createRateLimiter({ points: 3, duration: 60, keyPrefix });
    const originalError = new Error("memory exhaustion");
    vi.spyOn(brokenLimiter, "consume").mockRejectedValueOnce(originalError);
    // Make logger.warn throw to simulate logging failure
    vi.mocked(logger.warn).mockImplementationOnce(() => {
      throw new Error("logging service unavailable");
    });

    // The rate limit error should still propagate despite logger failure
    await expect(checkRateLimit(brokenLimiter, "test-key")).rejects.toThrow(
      `Rate limit check failed for keyPrefix "${keyPrefix}": memory exhaustion`,
    );
  });

  it("preserves original error as cause in wrapped error", async () => {
    const keyPrefix = `cause-${Date.now()}`;
    const brokenLimiter = createRateLimiter({ points: 3, duration: 60, keyPrefix });
    const originalError = new Error("memory exhaustion");
    vi.spyOn(brokenLimiter, "consume").mockRejectedValueOnce(originalError);

    try {
      await checkRateLimit(brokenLimiter, "test-key");
      expect.fail("Expected checkRateLimit to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).cause).toBe(originalError);
    }
  });
});

describe("pre-configured limiters", () => {
  it("loginLimiter exists with correct config (5 points, 900s duration)", () => {
    expect(loginLimiter).toBeDefined();
    // Verify by accessing internal properties
    expect(loginLimiter.points).toBe(5);
    expect(loginLimiter.duration).toBe(900);
  });

  it("registerLimiter exists with correct config (5 points, 3600s duration)", () => {
    expect(registerLimiter).toBeDefined();
    expect(registerLimiter.points).toBe(5);
    expect(registerLimiter.duration).toBe(3600);
  });

  it("verifyEmailLimiter exists with correct config", () => {
    expect(verifyEmailLimiter).toBeDefined();
    expect(verifyEmailLimiter.points).toBe(10);
    expect(verifyEmailLimiter.duration).toBe(3600);
  });

  it("requestResetLimiter exists with correct config", () => {
    expect(requestResetLimiter).toBeDefined();
    expect(requestResetLimiter.points).toBe(5);
    expect(requestResetLimiter.duration).toBe(3600);
  });

  it("resetPasswordLimiter exists with correct config", () => {
    expect(resetPasswordLimiter).toBeDefined();
    expect(resetPasswordLimiter.points).toBe(10);
    expect(resetPasswordLimiter.duration).toBe(3600);
  });

  it("apiAccountLimiter exists with correct config", () => {
    expect(apiAccountLimiter).toBeDefined();
    expect(apiAccountLimiter.points).toBe(100);
    expect(apiAccountLimiter.duration).toBe(60);
  });

  it("exports all 6 limiters", () => {
    const limiters = [
      loginLimiter,
      registerLimiter,
      verifyEmailLimiter,
      requestResetLimiter,
      resetPasswordLimiter,
      apiAccountLimiter,
    ];
    expect(limiters).toHaveLength(6);
    limiters.forEach((l) => expect(l).toBeDefined());
  });
});

describe("normaliseIp", () => {
  it("strips ::ffff: prefix from IPv4-mapped IPv6 addresses", () => {
    expect(normaliseIp("::ffff:192.168.1.1")).toBe("192.168.1.1");
    expect(normaliseIp("::ffff:10.0.0.1")).toBe("10.0.0.1");
    expect(normaliseIp("::ffff:127.0.0.1")).toBe("127.0.0.1");
  });

  it("passes through plain IPv4 unchanged", () => {
    expect(normaliseIp("203.0.113.50")).toBe("203.0.113.50");
  });

  it("passes through plain IPv6 unchanged", () => {
    expect(normaliseIp("2001:db8::1")).toBe("2001:db8::1");
  });

  it("passes through IPv6 localhost (::1) unchanged", () => {
    expect(normaliseIp("::1")).toBe("::1");
  });

  it("handles uppercase ::FFFF: prefix (case-insensitive per RFC 4291)", () => {
    expect(normaliseIp("::FFFF:192.168.1.1")).toBe("192.168.1.1");
    expect(normaliseIp("::Ffff:10.0.0.1")).toBe("10.0.0.1");
  });
});

import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";

import { logger } from "@/lib/logger";

/**
 * Extract client IP address from request headers.
 *
 * Priority: x-forwarded-for (first IP) > x-real-ip > "unknown"
 * Normalises IPv4-mapped IPv6 addresses (::ffff:x.x.x.x → x.x.x.x)
 * to prevent rate limit bypass via dual-stack IPs.
 *
 * Note: The "unknown" fallback means all clients without IP headers
 * (e.g., in local dev/test environments) share a single rate limit bucket.
 * This is intentional — in production, Vercel always sets x-forwarded-for.
 */
export function getClientIp(headersList: Headers): string {
  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0].trim();
    if (firstIp) return normaliseIp(firstIp);
  }

  const realIp = headersList.get("x-real-ip");
  if (realIp) {
    return normaliseIp(realIp.trim());
  }

  return "unknown";
}

/**
 * Normalise IPv4-mapped IPv6 addresses to their IPv4 equivalent.
 * Without this, the same client gets two rate limit buckets.
 *
 * Case-insensitive on the `::ffff:` prefix per RFC 4291 (IPv6 text
 * representation is case-insensitive). Some proxies may send uppercase
 * `::FFFF:` — both forms are handled.
 *
 * Note: `::1` (IPv6 localhost) is NOT an IPv4-mapped address and passes
 * through unchanged. It is handled separately by `maskIp()` in pii.ts
 * which special-cases it to "localhost:***" for clearer log output.
 *
 * Exported for isolated unit testing of IPv4-mapped IPv6 edge cases.
 */
export function normaliseIp(ip: string): string {
  if (ip.toLowerCase().startsWith("::ffff:")) {
    return ip.slice(7);
  }
  return ip;
}

/**
 * Factory to create a rate limiter instance with the given configuration.
 */
export function createRateLimiter(options: {
  points: number;
  duration: number;
  keyPrefix: string;
}): RateLimiterMemory {
  return new RateLimiterMemory({
    points: options.points,
    duration: options.duration,
    keyPrefix: options.keyPrefix,
  });
}

/**
 * Check rate limit for a given key. Consumes one point.
 *
 * Returns `{ allowed: true }` if under limit, or
 * `{ allowed: false, retryAfter: N }` if rate-limited (retryAfter in whole seconds, ceiling-rounded).
 *
 * Note: `RateLimiterMemory.consume()` throws (rejects) when rate limit is exceeded.
 */
export async function checkRateLimit(
  limiter: RateLimiterMemory,
  key: string,
): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {
  try {
    await limiter.consume(key);
    return { allowed: true };
  } catch (error) {
    if (error instanceof RateLimiterRes) {
      const retryAfter = Math.ceil(error.msBeforeNext / 1000);
      if (retryAfter <= 0) {
        logger.warn("Rate limiter retryAfter was zero or negative before floor", {
          msBeforeNext: error.msBeforeNext,
          ceiledValue: retryAfter,
        });
      }
      return { allowed: false, retryAfter: Math.max(retryAfter, 1) };
    }
    // Unexpected error — wrap with context and re-throw so caller sees the failure.
    // Log before re-throwing for production debugging (memory exhaustion, internal bugs).
    // Logging is failure-isolated: if logger throws, the rate limit error still propagates
    // (Story 1.4 pattern — logging must never break the security boundary).
    const errorMessage = error instanceof Error ? error.message : String(error);
    try {
      logger.warn("Rate limiter unexpected error", {
        error: errorMessage,
        keyPrefix: limiter.keyPrefix,
        key,
      });
    } catch {
      // Logging failure is non-critical — ensure the rate limit error still propagates
    }
    throw new Error(
      `Rate limit check failed for keyPrefix "${limiter.keyPrefix}": ${errorMessage}`,
      { cause: error },
    );
  }
}

// ---------------------------------------------------------------------------
// Pre-configured limiter instances (see Rate Limit Configuration Table in story)
// ---------------------------------------------------------------------------

/** Login: 5 attempts per IP per 15 minutes — brute-force credential protection */
export const loginLimiter = createRateLimiter({
  points: 5,
  duration: 900,
  keyPrefix: "login",
});

/** Registration: 5 attempts per IP per 60 minutes — spam/abuse prevention */
export const registerLimiter = createRateLimiter({
  points: 5,
  duration: 3600,
  keyPrefix: "register",
});

/** Email verification: 10 attempts per IP per 60 minutes — brute-force token guessing */
export const verifyEmailLimiter = createRateLimiter({
  points: 10,
  duration: 3600,
  keyPrefix: "verify-email",
});

/** Password reset request: 5 per IP per 60 minutes — email bombing prevention */
export const requestResetLimiter = createRateLimiter({
  points: 5,
  duration: 3600,
  keyPrefix: "request-reset",
});

/** Password reset: 10 attempts per IP per 60 minutes — brute-force token guessing */
export const resetPasswordLimiter = createRateLimiter({
  points: 10,
  duration: 3600,
  keyPrefix: "reset-password",
});

/** Profile update: 10 attempts per IP per 60 minutes — abuse prevention */
export const updateProfileLimiter = createRateLimiter({
  points: 10,
  duration: 3600,
  keyPrefix: "update-profile",
});

/** Email change request: 3 attempts per IP per 60 minutes — strict, triggers transactional emails */
export const requestEmailChangeLimiter = createRateLimiter({
  points: 3,
  duration: 3600,
  keyPrefix: "request-email-change",
});

/** API: 100 requests per key per 60 seconds — per-account API rate limit (FR70) */
export const apiAccountLimiter = createRateLimiter({
  points: 100,
  duration: 60,
  keyPrefix: "api-account",
});

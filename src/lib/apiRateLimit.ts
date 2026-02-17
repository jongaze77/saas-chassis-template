import { NextResponse } from "next/server";

import { ErrorCode, createErrorEnvelope } from "@/lib/errors";
import { apiAccountLimiter, checkRateLimit } from "@/lib/rateLimit";

/**
 * Check per-account API rate limit for Route Handlers.
 *
 * Returns `null` if the request is allowed, or a `NextResponse` (429)
 * with `Retry-After` header and error envelope if rate-limited.
 *
 * @param _request - The incoming request. Reserved for potential context-based
 *   rate limiting strategies (e.g., request size limits, user-agent analysis,
 *   or IP-based secondary checks). Currently unused as rate limiting is purely
 *   key-based. Do not remove — Epic 2+ may leverage request context for
 *   adaptive rate limiting.
 * @param accountKey - Rate limit key (API key or account ID)
 */
export async function withApiRateLimit(
  _request: Request,
  accountKey: string,
): Promise<NextResponse | null> {
  const result = await checkRateLimit(apiAccountLimiter, accountKey);

  if (result.allowed) {
    return null;
  }

  return NextResponse.json(
    createErrorEnvelope(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      "Too many requests. Please try again later.",
      { retryAfter: result.retryAfter },
    ),
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfter) },
    },
  );
}

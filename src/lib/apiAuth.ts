import { NextResponse } from "next/server";

import { withApiRateLimit } from "@/lib/apiRateLimit";
import { ErrorCode, createErrorEnvelope } from "@/lib/errors";

/**
 * Minimum length for API key format validation.
 *
 * 20 chars reduces trivial bypass attempts while accommodating common key
 * formats — base64url-encoded 128-bit tokens are 22+ chars, and most API key
 * standards (Stripe 32+, AWS 20+) meet this threshold. Not cryptographically
 * significant — this is a sanity gate to prevent single-character or very short
 * tokens from each getting their own rate limit bucket. Full API key validation
 * (DB lookup, account resolution) is deferred to Epic 2 Story 2-1.
 */
const MIN_API_KEY_LENGTH = 20;

/** Discriminated union for withApiAuth results — type-safe at call sites. */
export type ApiAuthResult =
  | { success: true; apiKey: string }
  | { success: false; response: NextResponse };

/**
 * Authenticate and rate-limit an API request.
 *
 * Extracts API key from the `Authorization: Bearer <key>` header, validates
 * it is present and meets minimum length, then checks rate limits keyed by
 * the API key.
 *
 * Returns a discriminated union:
 * - `{ success: true, apiKey }` — request may proceed
 * - `{ success: false, response }` — return the response (401 or 429)
 *
 * Call-site pattern:
 * ```ts
 * const authResult = await withApiAuth(request);
 * if (!authResult.success) return authResult.response;
 * // authResult.apiKey is now typed as string
 * ```
 *
 * INTENTIONAL SCOPE LIMITATION: The current implementation accepts any string
 * of sufficient length as an API key — there is no DB validation that the key
 * maps to a real account. This means rate limiting is per-key, not per-account.
 * An attacker could generate unique long tokens to get separate rate limit
 * buckets, but all API routes are 501 stubs with no data access, so no data
 * is exposed. This is acceptable for MVP.
 *
 * TODO: [Epic 2, Story 2-1] Implement proper API key validation and account
 * resolution. Once API key -> account mapping exists, use accountId instead
 * for true per-account limiting. The MIN_API_KEY_LENGTH check can then be
 * replaced with a proper DB lookup.
 */
export async function withApiAuth(
  request: Request,
): Promise<ApiAuthResult> {
  const authHeader = request.headers.get("authorization");
  const apiKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!apiKey || apiKey.length < MIN_API_KEY_LENGTH) {
    return {
      success: false,
      response: NextResponse.json(
        createErrorEnvelope(ErrorCode.AUTH_ERROR, "API key required"),
        { status: 401 },
      ),
    };
  }

  const rateLimitResponse = await withApiRateLimit(request, apiKey);
  if (rateLimitResponse) return { success: false, response: rateLimitResponse };

  return { success: true, apiKey };
}

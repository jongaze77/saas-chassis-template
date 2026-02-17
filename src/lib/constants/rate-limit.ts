/**
 * Rate limit error message constants.
 *
 * Used by server actions (returned as error messages) and client components
 * (whitelisted in SAFE_*_MESSAGES sets in auth-errors.ts).
 */

/** Shared prefix for all rate limit messages — used by isRateLimitMessage() for matching */
export const RATE_LIMITED_PREFIX = "Too many attempts.";

/** Base rate limit message (no retry time) */
export const RATE_LIMITED = `${RATE_LIMITED_PREFIX} Please try again later.`;

/** Dynamic rate limit message with retry guidance */
export function RATE_LIMITED_WITH_RETRY(seconds: number): string {
  return `${RATE_LIMITED_PREFIX} Please try again in ${seconds} seconds.`;
}

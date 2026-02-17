/**
 * Centralized error messages for settings actions and components.
 *
 * This file is the single source of truth for user-facing error strings
 * returned by settings server actions AND displayed by settings client
 * components. Same pattern as auth-errors.ts.
 */

import { RATE_LIMITED, RATE_LIMITED_PREFIX } from "@/lib/constants/rate-limit";

// ---------------------------------------------------------------------------
// Rate limit message helper — handles dynamic "in X seconds" messages
// ---------------------------------------------------------------------------

/**
 * Check if a message is a rate limit error (exact or with dynamic retry seconds).
 * Used by client component sanitizeError functions to allow rate limit
 * messages through the whitelist.
 */
export function isRateLimitMessage(message: string): boolean {
  return message === RATE_LIMITED || message.startsWith(RATE_LIMITED_PREFIX);
}

// ---------------------------------------------------------------------------
// Settings error/success messages
// ---------------------------------------------------------------------------

/** Generic fallback for unexpected errors */
export const SETTINGS_GENERIC_ERROR = "Something went wrong. Please try again.";

/** Password verification failed during email change */
export const PASSWORD_INCORRECT = "Current password is incorrect";

/** New email is same as current */
export const EMAIL_SAME_AS_CURRENT = "New email must be different from current email";

/** Email change verification sent */
export const EMAIL_CHANGE_SENT =
  "Verification email sent. Your email will update after you verify.";

/** Email change confirmed */
export const EMAIL_CHANGE_CONFIRMED =
  "Email updated successfully. Please log in with your new email.";

/** Invalid or expired email change token */
export const EMAIL_CHANGE_INVALID_TOKEN =
  "This verification link is invalid or has expired.";

/** Profile name updated */
export const NAME_UPDATED = "Profile name updated successfully.";

// ---------------------------------------------------------------------------
// Zod validation error messages (returned by settings validators)
// ---------------------------------------------------------------------------

/** Name field is empty or whitespace-only */
export const SETTINGS_NAME_REQUIRED = "Name is required";

/** Name exceeds 100-character limit */
export const SETTINGS_NAME_TOO_LONG = "Name must be 100 characters or fewer";

/** Invalid email format in email change form */
export const SETTINGS_INVALID_EMAIL = "Please enter a valid email address";

/** Password field is empty in email change form */
export const SETTINGS_PASSWORD_REQUIRED = "Current password is required";

/**
 * All messages that settings forms are allowed to display.
 * Any message NOT in this set will be replaced with SETTINGS_GENERIC_ERROR.
 */
export const SAFE_SETTINGS_MESSAGES: ReadonlySet<string> = new Set([
  SETTINGS_GENERIC_ERROR,
  PASSWORD_INCORRECT,
  EMAIL_SAME_AS_CURRENT,
  EMAIL_CHANGE_SENT,
  EMAIL_CHANGE_CONFIRMED,
  EMAIL_CHANGE_INVALID_TOKEN,
  NAME_UPDATED,
  SETTINGS_NAME_REQUIRED,
  SETTINGS_NAME_TOO_LONG,
  SETTINGS_INVALID_EMAIL,
  SETTINGS_PASSWORD_REQUIRED,
  RATE_LIMITED,
]);

/**
 * Check if a message is in the settings safe message set.
 * Used by client components for error sanitization.
 */
export function isSettingsMessage(msg: string): boolean {
  return SAFE_SETTINGS_MESSAGES.has(msg);
}

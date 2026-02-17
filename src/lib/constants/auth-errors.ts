/**
 * Centralized error messages for authentication actions and components.
 *
 * This file is the single source of truth for user-facing error strings
 * returned by loginUser/logoutUser server actions AND displayed by
 * LoginForm/LogoutButton client components. Adding or changing a message
 * here automatically keeps both sides in sync — no manual whitelist
 * maintenance required.
 */

import { RATE_LIMITED, RATE_LIMITED_PREFIX } from "@/lib/constants/rate-limit";

// ---------------------------------------------------------------------------
// Rate limit message helper — handles dynamic "in X seconds" messages
// ---------------------------------------------------------------------------

/**
 * Check if a message is a rate limit error (exact or with dynamic retry seconds).
 * Used by client component sanitizeError functions to allow rate limit
 * messages through the whitelist without needing every possible second value in the Set.
 *
 * Uses `startsWith` for efficiency (no regex compilation). The prefix
 * "Too many attempts." is unique enough to avoid false positives — no other
 * error messages in the codebase start with this phrase. If this assumption
 * changes, switch to exact match against a pre-built Set of known messages.
 */
export function isRateLimitMessage(message: string): boolean {
  return message === RATE_LIMITED || message.startsWith(RATE_LIMITED_PREFIX);
}

// ---------------------------------------------------------------------------
// Login error messages (returned by loginUser server action)
// ---------------------------------------------------------------------------

/** Generic credential failure — used for wrong password, missing user, no passwordHash */
export const LOGIN_INVALID_CREDENTIALS = "Invalid email or password";

/** Unverified email — LoginForm detects this to show the resend-verification UI */
export const LOGIN_EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED";

/** Server-side failure — accountId guard or unexpected catch */
export const LOGIN_FAILED = "Login failed. Please try again.";

// Validation errors (from loginSchema — these flow through actionError)
export const LOGIN_INVALID_EMAIL = "Please enter a valid email address";
export const LOGIN_PASSWORD_REQUIRED = "Password is required";

/** Network failure during login */
export const LOGIN_NETWORK_ERROR =
  "Unable to connect to the server. Please check your connection and try again.";

/**
 * All error messages that LoginForm is allowed to display.
 * Any message NOT in this set will be replaced with GENERIC_ERROR.
 */
export const SAFE_LOGIN_MESSAGES: ReadonlySet<string> = new Set([
  LOGIN_INVALID_CREDENTIALS,
  LOGIN_EMAIL_NOT_VERIFIED,
  LOGIN_FAILED,
  LOGIN_INVALID_EMAIL,
  LOGIN_PASSWORD_REQUIRED,
  LOGIN_NETWORK_ERROR,
  RATE_LIMITED,
]);

// ---------------------------------------------------------------------------
// Logout error messages (returned by logoutUser server action)
// ---------------------------------------------------------------------------

/** Server-side failure during logout */
export const LOGOUT_FAILED = "Logout failed. Please try again.";

/** Network failure during logout */
export const LOGOUT_NETWORK_ERROR =
  "Unable to connect to the server. Please try again.";

/**
 * All error messages that LogoutButton is allowed to display.
 * Any message NOT in this set will be replaced with GENERIC_ERROR.
 */
export const SAFE_LOGOUT_MESSAGES: ReadonlySet<string> = new Set([
  LOGOUT_FAILED,
  LOGOUT_NETWORK_ERROR,
]);

// ---------------------------------------------------------------------------
// Generic fallback (shown when an unknown error reaches the client)
// ---------------------------------------------------------------------------

export const GENERIC_ERROR = "Something went wrong. Please try again.";

// ---------------------------------------------------------------------------
// Password reset error messages (returned by requestPasswordReset / resetPassword)
// ---------------------------------------------------------------------------

/** Confirmation message — shown whether or not the email exists (AC5 email enumeration prevention) */
export const PASSWORD_RESET_CONFIRMATION =
  "If an account exists with that email, you'll receive a reset link shortly.";

/** Invalid reset token — generic message to avoid revealing token state.
 *  Covers both invalid and expired tokens (R2-M3 security fix). */
export const PASSWORD_RESET_INVALID_TOKEN =
  "This reset link is invalid. Please request a new one.";

/** Successful password reset — shown on login page */
export const PASSWORD_RESET_SUCCESS =
  "Your password has been reset successfully. Please log in with your new password.";

/** Generic password reset failure */
export const PASSWORD_RESET_FAILED = "Password reset failed. Please try again.";

// Validation errors (from schemas — these flow through actionError)
export const PASSWORD_RESET_INVALID_EMAIL = "Please enter a valid email address";
export const PASSWORD_RESET_PASSWORD_TOO_SHORT = "Password must be at least 8 characters";

/** Network failure during password reset request */
export const PASSWORD_RESET_NETWORK_ERROR =
  "Unable to connect to the server. Please try again.";

/**
 * All messages that ForgotPasswordForm is allowed to display.
 * Any message NOT in this set will be replaced with GENERIC_ERROR.
 */
export const SAFE_PASSWORD_RESET_REQUEST_MESSAGES: ReadonlySet<string> = new Set([
  PASSWORD_RESET_CONFIRMATION,
  PASSWORD_RESET_INVALID_EMAIL,
  PASSWORD_RESET_NETWORK_ERROR,
  PASSWORD_RESET_FAILED,
  RATE_LIMITED,
]);

/**
 * All messages that ResetPasswordForm is allowed to display.
 * Any message NOT in this set will be replaced with GENERIC_ERROR.
 */
export const SAFE_PASSWORD_RESET_MESSAGES: ReadonlySet<string> = new Set([
  PASSWORD_RESET_INVALID_TOKEN,
  PASSWORD_RESET_SUCCESS,
  PASSWORD_RESET_FAILED,
  PASSWORD_RESET_PASSWORD_TOO_SHORT,
  PASSWORD_RESET_NETWORK_ERROR,
  RATE_LIMITED,
]);

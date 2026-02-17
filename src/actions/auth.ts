"use server";

import crypto from "crypto";

import bcrypt from "bcrypt";
import { cookies, headers } from "next/headers";

import { ActorType, EventType } from "@/generated/prisma/enums";
import {
  LOGIN_EMAIL_NOT_VERIFIED,
  LOGIN_FAILED,
  LOGIN_INVALID_CREDENTIALS,
  LOGOUT_FAILED,
  PASSWORD_RESET_CONFIRMATION,
  PASSWORD_RESET_FAILED,
  PASSWORD_RESET_INVALID_TOKEN,
} from "@/lib/constants/auth-errors";
import { RATE_LIMITED_WITH_RETRY } from "@/lib/constants/rate-limit";
import { withoutTenantScope } from "@/lib/db";
import { env } from "@/lib/env";
import { actionError, actionSuccess } from "@/lib/errors";
import { inngest } from "@/lib/inngest/client";
import { logger } from "@/lib/logger";
import { maskEmail, maskIp } from "@/lib/pii";
import {
  checkRateLimit,
  getClientIp,
  loginLimiter,
  registerLimiter,
  requestResetLimiter,
  resetPasswordLimiter,
  verifyEmailLimiter,
} from "@/lib/rateLimit";
import {
  loginSchema,
  registrationSchema,
  requestPasswordResetSchema,
  resendVerificationSchema,
  resetPasswordSchema,
} from "@/lib/validators/auth";

/** Token validity window: 24 hours in milliseconds */
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Generate a cryptographically secure verification token.
 * Uses 256-bit random bytes encoded as base64url for stronger entropy
 * than UUID v4 (122 bits), reducing brute-force risk over the 24h token window.
 */
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  // 1. Rate limit check (FIRST — before any other work)
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const rateLimitResult = await checkRateLimit(registerLimiter, ip);
  if (!rateLimitResult.allowed) {
    // Note: logger module automatically adds ISO 8601 timestamp to all log entries.
    // TODO: [Tech Debt: Observability — Epic 2+] Add request-scoped correlation IDs
    // for cross-instance log correlation when monitoring DDoS patterns at scale.
    logger.warn("Rate limit exceeded for registration", {
      endpoint: "registerUser",
      limiter: "register",
      ip: ip === "unknown" ? "unknown" : maskIp(ip),
      retryAfter: rateLimitResult.retryAfter,
    });
    return actionError(RATE_LIMITED_WITH_RETRY(rateLimitResult.retryAfter));
  }

  // 2. Validate input
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0].message);
  }

  const { name, email, password } = parsed.data;
  const prisma = withoutTenantScope();

  try {
    // 2. Check email uniqueness
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return actionError("Email already registered");
    }

    // 3. Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // 4. Transaction: create Account, User, VerificationToken, Event
    // All operations are atomic — if ANY step (including Event creation) fails,
    // the entire transaction rolls back. Failures are caught by the outer
    // try-catch which logs details and returns a user-friendly message.
    const token = generateSecureToken();
    const { user } = await prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: { name },
      });

      const user = await tx.user.create({
        data: {
          accountId: account.id,
          email,
          name,
          passwordHash,
        },
      });

      await tx.verificationToken.create({
        data: {
          identifier: email,
          token,
          expires: new Date(Date.now() + TOKEN_EXPIRY_MS),
        },
      });

      await tx.event.create({
        data: {
          type: EventType.USER_JOINED,
          actorType: ActorType.USER,
          actorId: user.id,
          targetType: "User",
          targetId: user.id,
          accountId: account.id,
        },
      });

      return { account, user };
    });

    // 5. Dispatch Inngest event AFTER transaction
    // Catch Inngest failures separately — the user/account are already committed.
    // If email dispatch fails, user can still use "Resend verification" later.
    let emailDispatchFailed = false;
    try {
      await inngest.send({
        name: "auth/verification.requested",
        data: { email, name, token },
      });
    } catch (inngestError) {
      emailDispatchFailed = true;
      logger.error("Failed to dispatch verification email via Inngest", {
        email,
        accountId: user.accountId,
        userId: user.id,
        error: inngestError instanceof Error ? inngestError.message : String(inngestError),
      });
    }

    logger.info("User registered", { accountId: user.accountId, email });

    return actionSuccess(
      { email },
      emailDispatchFailed
        ? "Account created, but we had trouble sending the verification email. Please use the resend option."
        : undefined,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Prisma P2002 = unique constraint violation (handles race condition between
    // findUnique check and user.create — concurrent registration with same email)
    const isUniqueViolation =
      (error instanceof Error && "code" in error && (error as { code: string }).code === "P2002") ||
      errorMessage.includes("Unique constraint");
    const isDbError = isUniqueViolation || errorMessage.includes("prisma");
    logger.error("Registration failed", {
      email,
      error: errorMessage,
      category: isUniqueViolation ? "unique_constraint" : isDbError ? "database" : "unexpected",
    });
    return actionError(
      isUniqueViolation
        ? "Email already registered"
        : "Registration failed. Please try again.",
    );
  }
}

// TODO: [Tech Debt: Token Cleanup — Epic 2+] Add scheduled cleanup of expired
// VerificationToken records to prevent table bloat. Implement as an Inngest
// cron function (e.g., daily) that deletes tokens where expires < NOW().
export async function verifyEmail(token: string) {
  // 1. Rate limit check (FIRST — before any other work)
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const rateLimitResult = await checkRateLimit(verifyEmailLimiter, ip);
  if (!rateLimitResult.allowed) {
    logger.warn("Rate limit exceeded for email verification", {
      endpoint: "verifyEmail",
      limiter: "verify-email",
      ip: ip === "unknown" ? "unknown" : maskIp(ip),
      retryAfter: rateLimitResult.retryAfter,
    });
    return actionError(RATE_LIMITED_WITH_RETRY(rateLimitResult.retryAfter));
  }

  const prisma = withoutTenantScope();

  try {
    // 2. Look up token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return actionError("This verification link is invalid. Request a new one.");
    }

    // 2. Check expiry — delete expired token to prevent timing-based attacks
    if (verificationToken.expires < new Date()) {
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: verificationToken.identifier,
            token: verificationToken.token,
          },
        },
      }).catch(() => {
        // Non-critical: token may have been concurrently deleted; log and continue
        logger.warn("Failed to delete expired verification token", {
          identifier: verificationToken.identifier,
        });
      });
      return actionError(
        "This verification link has expired. Request a new one.",
      );
    }

    // 3. Transaction: update user, delete token, create audit event
    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { email: verificationToken.identifier },
        data: { emailVerified: new Date() },
      });

      await tx.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: verificationToken.identifier,
            token: verificationToken.token,
          },
        },
      });

      await tx.event.create({
        data: {
          type: EventType.USER_EMAIL_VERIFIED,
          actorType: ActorType.USER,
          actorId: user.id,
          targetType: "User",
          targetId: user.id,
          accountId: user.accountId,
        },
      });

      return user;
    });

    logger.info("Email verified", {
      userId: updatedUser.id,
      email: verificationToken.identifier,
    });

    return actionSuccess({ verified: true });
  } catch (error) {
    logger.error("Email verification failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return actionError("Verification failed. Please try again.");
  }
}

export async function resendVerification(input: { email: string }) {
  // 1. Rate limit check (FIRST — before any other work)
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const rateLimitResult = await checkRateLimit(verifyEmailLimiter, ip);
  if (!rateLimitResult.allowed) {
    logger.warn("Rate limit exceeded for resend verification", {
      endpoint: "resendVerification",
      limiter: "verify-email",
      ip: ip === "unknown" ? "unknown" : maskIp(ip),
      retryAfter: rateLimitResult.retryAfter,
    });
    return actionError(RATE_LIMITED_WITH_RETRY(rateLimitResult.retryAfter));
  }

  // 2. Validate
  const parsed = resendVerificationSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0].message);
  }

  const { email } = parsed.data;
  const prisma = withoutTenantScope();

  try {
    // 2. Find unverified user
    const user = await prisma.user.findUnique({ where: { email } });

    // Return success even if not found (prevent email enumeration)
    if (!user || user.emailVerified) {
      return actionSuccess({ sent: true });
    }

    // 3. Delete existing tokens and create new one atomically
    const token = generateSecureToken();
    await prisma.$transaction(async (tx) => {
      await tx.verificationToken.deleteMany({
        where: { identifier: email },
      });

      await tx.verificationToken.create({
        data: {
          identifier: email,
          token,
          expires: new Date(Date.now() + TOKEN_EXPIRY_MS),
        },
      });
    });

    // 4. Dispatch Inngest event AFTER transaction
    // Catch Inngest failures separately — token is already created in DB.
    // If email dispatch fails, user can try resending again.
    try {
      await inngest.send({
        name: "auth/verification.requested",
        data: { email, name: user.name ?? "", token },
      });
    } catch (inngestError) {
      logger.error("Failed to dispatch resend verification email via Inngest", {
        email,
        userId: user.id,
        error: inngestError instanceof Error ? inngestError.message : String(inngestError),
      });
      // Still return success — token is created. User can try resending again.
    }

    logger.info("Verification email resent", { userId: user.id, email });

    return actionSuccess({ sent: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isDbError = errorMessage.includes("Unique constraint") || errorMessage.includes("prisma");
    logger.error("Resend verification failed", {
      email,
      error: errorMessage,
      category: isDbError ? "database" : "unexpected",
    });
    return actionError(
      isDbError
        ? "A verification request is already being processed. Please try again shortly."
        : "Failed to resend verification. Please try again.",
    );
  }
}

/** Session expiry: 24 hours in milliseconds (NFR12) */
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Determine Auth.js cookie name based on environment.
 * Must match the names checked in src/middleware.ts (lines 18-20).
 */
const useSecureCookies = env.NEXTAUTH_URL.startsWith("https://");
const SESSION_COOKIE_NAME = useSecureCookies
  ? "__Secure-authjs.session-token"
  : "authjs.session-token";

/**
 * Authenticate a user with email and password, creating a database session.
 *
 * Uses custom session management (not Auth.js Credentials provider) to ensure
 * database sessions are created. Sets a session cookie matching Auth.js naming
 * convention so `auth()` can read it.
 *
 * @param input.email - User's email address (trimmed and lowercased by schema)
 * @param input.password - User's plaintext password (compared against bcrypt hash)
 * @returns ActionResult with `{ redirectTo: "/dashboard" }` on success,
 *   `"EMAIL_NOT_VERIFIED"` error for unverified emails, or generic error message
 */
export async function loginUser(input: { email: string; password: string }) {
  // 1. Rate limit check (FIRST — before any other work)
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const rateLimitResult = await checkRateLimit(loginLimiter, ip);
  if (!rateLimitResult.allowed) {
    logger.warn("Rate limit exceeded for login", {
      endpoint: "loginUser",
      limiter: "login",
      ip: ip === "unknown" ? "unknown" : maskIp(ip),
      retryAfter: rateLimitResult.retryAfter,
    });
    return actionError(RATE_LIMITED_WITH_RETRY(rateLimitResult.retryAfter));
  }

  // 2. Validate input
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0].message);
  }

  const { email, password } = parsed.data;
  const prisma = withoutTenantScope();

  try {
    // 2. Find user by email — generic error if not found (prevent email enumeration)
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return actionError(LOGIN_INVALID_CREDENTIALS);
    }

    // 3. Check email verified — specific error so form can show verify message + resend link
    if (!user.emailVerified) {
      return { success: false as const, error: LOGIN_EMAIL_NOT_VERIFIED };
    }

    // 4. Check passwordHash exists — covers OAuth-only users
    if (!user.passwordHash) {
      return actionError(LOGIN_INVALID_CREDENTIALS);
    }

    // 5. Compare password — generic error if no match
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return actionError(LOGIN_INVALID_CREDENTIALS);
    }

    // 6. Validate accountId — required for session creation (guards against data corruption)
    if (!user.accountId) {
      logger.error("User missing accountId during login", { userId: user.id, email: maskEmail(email) });
      return actionError(LOGIN_FAILED);
    }
    // Type narrowing: after the guard above, accountId is guaranteed non-null.
    // Explicit assertion for TypeScript safety if guard is ever refactored.
    const accountId: string = user.accountId;

    // 7. Clean up existing sessions for this user to prevent stale session accumulation.
    // This enforces a single-session-per-user model: logging in from a new browser/device
    // intentionally invalidates all previous sessions. Other tabs/devices will see
    // "session expired" on their next request — this is expected security behavior.
    // Non-critical: if cleanup fails, we still create the new session.
    try {
      await prisma.session.deleteMany({ where: { userId: user.id } });
    } catch {
      logger.warn("Failed to clean up existing sessions during login", {
        userId: user.id,
        email: maskEmail(email),
      });
    }

    // 8. Create session — use 256-bit random token (matches generateSecureToken entropy)
    // Initial expiry is 24h from now. Auth.js auth() extends the expiry on activity
    // via the updateAge setting (1h), making this a true 24h INACTIVITY expiry (AC5/NFR12).
    const sessionToken = crypto.randomBytes(32).toString("base64url");
    const expires = new Date(Date.now() + SESSION_EXPIRY_MS);

    await prisma.session.create({
      data: {
        sessionToken,
        userId: user.id,
        accountId,
        expires,
      },
    });

    // 9. Set session cookie (matches Auth.js cookie convention)
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: useSecureCookies,
      sameSite: "lax",
      path: "/",
      expires,
    });

    // 10. Log successful login
    // TODO: [Tech Debt: Audit Events — Epic 2+] Add USER_LOGIN event type for full audit trail.
    // Session creation with created_at timestamps is queryable in the interim.
    // TODO: [Tech Debt: Log Security — Epic 2+] Ensure production log aggregation has proper
    // access controls — session token prefixes in logs could aid targeted attacks
    // if logs are exposed. See also logoutUser warning logs.
    logger.info("User logged in", {
      userId: user.id,
      email: maskEmail(email),
      sessionPrefix: sessionToken.slice(0, 8),
    });

    return actionSuccess({ redirectTo: "/dashboard" });
  } catch (error) {
    logger.error("Login failed", {
      email: maskEmail(email),
      error: error instanceof Error ? error.message : String(error),
    });
    return actionError(LOGIN_FAILED);
  }
}

/**
 * Log out the current user by destroying their database session and clearing the cookie.
 *
 * Gracefully handles cases where the session record is already expired or deleted.
 * Always clears the session cookie regardless of session record state.
 *
 * @returns ActionResult with `{ redirectTo: "/login" }` on success
 */
export async function logoutUser() {
  const prisma = withoutTenantScope();

  try {
    // 1. Read session cookie
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (sessionToken) {
      // 2. Validate session token format before DB query.
      // Tokens are base64url-encoded 32-byte strings (43 chars) or UUIDs (36 chars).
      // Reject clearly malformed values to provide clearer errors and avoid unnecessary DB calls.
      const isValidFormat = /^[\w-]{20,}$/.test(sessionToken);
      if (!isValidFormat) {
        logger.warn("Malformed session token during logout", {
          tokenLength: sessionToken.length,
        });
      } else {
        // 3. Delete session record — wrap in try-catch (session may already be expired/deleted)
        try {
          await prisma.session.delete({ where: { sessionToken } });
        } catch {
          // Session may already be expired or deleted — this is non-critical
          logger.warn("Session record not found during logout", { sessionPrefix: sessionToken.slice(0, 8) });
        }
      }
    }

    // 4. Clear session cookie — pass explicit attributes to match the .set() call
    // and ensure the browser correctly identifies the cookie to delete.
    cookieStore.delete({
      name: SESSION_COOKIE_NAME,
      httpOnly: true,
      secure: useSecureCookies,
      sameSite: "lax",
      path: "/",
    });

    logger.info("User logged out", {
      sessionPrefix: sessionToken ? sessionToken.slice(0, 8) : "none",
    });

    return actionSuccess({ redirectTo: "/login" });
  } catch (error) {
    logger.error("Logout failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return actionError(LOGOUT_FAILED);
  }
}

/**
 * Request a password reset email for the given email address.
 *
 * Returns the same success response regardless of whether the email exists
 * in the system (AC5: email enumeration prevention). If the email is found
 * and verified, a reset token is created and an email dispatched via Inngest.
 *
 * @param input.email - User's email address (trimmed and lowercased by schema)
 * @returns ActionResult with `{ sent: true }` and confirmation message
 */
export async function requestPasswordReset(input: { email: string }) {
  // 1. Rate limit check (FIRST — before any other work)
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const rateLimitResult = await checkRateLimit(requestResetLimiter, ip);
  if (!rateLimitResult.allowed) {
    logger.warn("Rate limit exceeded for password reset request", {
      endpoint: "requestPasswordReset",
      limiter: "request-reset",
      ip: ip === "unknown" ? "unknown" : maskIp(ip),
      retryAfter: rateLimitResult.retryAfter,
    });
    return actionError(RATE_LIMITED_WITH_RETRY(rateLimitResult.retryAfter));
  }

  // 2. Validate input
  const parsed = requestPasswordResetSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0].message);
  }

  const { email } = parsed.data;
  const prisma = withoutTenantScope();

  try {
    // 2. Look up user — if not found or not verified, return success anyway (AC5)
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.emailVerified) {
      return actionSuccess({ sent: true }, PASSWORD_RESET_CONFIRMATION);
    }

    // 3. Delete existing tokens and create new one atomically.
    // Safe to delete all tokens for this email — user is verified (checked above),
    // so no pending verification tokens exist.
    // Wrapped in $transaction to prevent concurrent reset requests from both
    // completing deleteMany before either creates, which would yield two valid tokens.
    const token = generateSecureToken();
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    await prisma.$transaction(async (tx) => {
      await tx.verificationToken.deleteMany({
        where: { identifier: email },
      });

      await tx.verificationToken.create({
        data: {
          identifier: email,
          token: hashedToken,
          expires: new Date(Date.now() + TOKEN_EXPIRY_MS),
        },
      });
    });

    // 4. Dispatch Inngest event with PLAINTEXT token (needed in email URL)
    // Separate try-catch from DB operations — if Inngest fails, token is still in DB
    // and user can retry.
    try {
      await inngest.send({
        name: "auth/password-reset.requested",
        data: { email, name: user.name ?? "", token },
      });
    } catch (inngestError) {
      // Log masked email only — avoid logging userId alongside masked email
      // to prevent PII correlation attacks in log aggregation
      logger.error("Failed to dispatch password reset email via Inngest", {
        email: maskEmail(email),
        error: inngestError instanceof Error ? inngestError.message : String(inngestError),
      });
    }

    // 5. Create audit event — failure-isolated (non-critical)
    // If audit event creation fails after token is created and email dispatched,
    // the user should still see success. Log the error for investigation.
    try {
      await prisma.event.create({
        data: {
          type: EventType.USER_PASSWORD_RESET_REQUESTED,
          actorType: ActorType.USER,
          actorId: user.id,
          targetType: "User",
          targetId: user.id,
          accountId: user.accountId,
        },
      });
    } catch (auditError) {
      logger.error("Failed to create password reset audit event", {
        userId: user.id,
        email: maskEmail(email),
        error: auditError instanceof Error ? auditError.message : String(auditError),
      });
    }

    logger.info("Password reset requested", {
      userId: user.id,
      email: maskEmail(email),
    });

    return actionSuccess({ sent: true }, PASSWORD_RESET_CONFIRMATION);
  } catch (error) {
    logger.error("Password reset request failed", {
      email: maskEmail(email),
      error: error instanceof Error ? error.message : String(error),
    });
    return actionError(PASSWORD_RESET_FAILED);
  }
}

/**
 * Reset a user's password using a valid reset token.
 *
 * Validates the token (SHA-256 hash lookup), checks expiry, then atomically:
 * updates the password, deletes the token, destroys all sessions, and creates
 * an audit event — all inside a single transaction. If any step fails, the
 * entire operation rolls back (AC3: mandatory session destruction).
 *
 * @param input.token - Plaintext token from the reset URL
 * @param input.password - New password (minimum 8 characters)
 * @returns ActionResult with `{ redirectTo: "/login?reset=true" }` on success
 */
export async function resetPassword(input: { token: string; password: string }) {
  // 1. Rate limit check (FIRST — before any other work)
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const rateLimitResult = await checkRateLimit(resetPasswordLimiter, ip);
  if (!rateLimitResult.allowed) {
    logger.warn("Rate limit exceeded for password reset", {
      endpoint: "resetPassword",
      limiter: "reset-password",
      ip: ip === "unknown" ? "unknown" : maskIp(ip),
      retryAfter: rateLimitResult.retryAfter,
    });
    return actionError(RATE_LIMITED_WITH_RETRY(rateLimitResult.retryAfter));
  }

  // 2. Validate password
  const parsed = resetPasswordSchema.safeParse({ password: input.password });
  if (!parsed.success) {
    return actionError(parsed.error.issues[0].message);
  }

  const { password } = parsed.data;

  // 2. Validate token format before hashing — reject clearly malformed input
  // early to avoid unnecessary crypto + DB operations. Tokens are 32-byte
  // base64url-encoded strings (43 chars, pattern: [A-Za-z0-9_-]).
  const TOKEN_FORMAT = /^[A-Za-z0-9_-]{40,50}$/;
  if (!input.token || !TOKEN_FORMAT.test(input.token)) {
    return actionError(PASSWORD_RESET_INVALID_TOKEN);
  }

  const prisma = withoutTenantScope();

  try {
    // 3. Hash the incoming token and look up in DB
    const hashedToken = crypto
      .createHash("sha256")
      .update(input.token)
      .digest("hex");

    const tokenRecord = await prisma.verificationToken.findUnique({
      where: { token: hashedToken },
    });

    if (!tokenRecord) {
      return actionError(PASSWORD_RESET_INVALID_TOKEN);
    }

    // 4. Check token expiry — delete expired token and return error
    // Security: uses the same generic error as invalid tokens (PASSWORD_RESET_INVALID_TOKEN)
    // to prevent attackers from distinguishing "token existed but expired" vs "token never existed".
    // This is an intentional security-over-UX trade-off.
    if (tokenRecord.expires < new Date()) {
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: tokenRecord.identifier,
            token: tokenRecord.token,
          },
        },
      }).catch(() => {
        logger.warn("Failed to delete expired password reset token", {
          identifier: maskEmail(tokenRecord.identifier),
        });
      });
      return actionError(PASSWORD_RESET_INVALID_TOKEN);
    }

    // 5. Find user by email from token record
    const user = await prisma.user.findUnique({
      where: { email: tokenRecord.identifier },
    });

    if (!user) {
      return actionError(PASSWORD_RESET_FAILED);
    }

    // Validate accountId — required for audit event (guards against data corruption).
    // Matches defensive pattern in loginUser for consistency.
    if (!user.accountId) {
      logger.error("User missing accountId during password reset", {
        userId: user.id,
        email: maskEmail(tokenRecord.identifier),
      });
      return actionError(PASSWORD_RESET_FAILED);
    }
    const accountId: string = user.accountId;

    // 6. Transaction: update password, delete token, destroy sessions, create event
    // ALL operations MUST be transactional — if session destruction fails,
    // password update must also roll back (AC3 security requirement).
    // bcrypt hash is computed INSIDE the transaction to avoid repeated expensive
    // bcrypt operations (12 rounds) if the transaction retries on serialization errors.
    await prisma.$transaction(async (tx) => {
      // Hash new password inside transaction
      const passwordHash = await bcrypt.hash(password, 12);

      // Update password
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      // Delete used token (single-use, AC3)
      await tx.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: tokenRecord.identifier,
            token: tokenRecord.token,
          },
        },
      });

      // Destroy ALL sessions — force logout on all devices (AC3)
      // MANDATORY: if this fails, the transaction rolls back the password update
      await tx.session.deleteMany({
        where: { userId: user.id },
      });

      // Create audit event
      await tx.event.create({
        data: {
          type: EventType.USER_PASSWORD_RESET_COMPLETED,
          actorType: ActorType.USER,
          actorId: user.id,
          targetType: "User",
          targetId: user.id,
          accountId,
        },
      });
    });

    logger.info("Password reset completed", {
      userId: user.id,
      email: maskEmail(tokenRecord.identifier),
    });

    return actionSuccess({ redirectTo: "/login?reset=true" });
  } catch (error) {
    logger.error("Password reset failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return actionError(PASSWORD_RESET_FAILED);
  }
}

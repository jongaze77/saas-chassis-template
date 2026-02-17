"use server";

import crypto from "crypto";

import bcrypt from "bcrypt";
import { headers } from "next/headers";

import { ActorType, EventType } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { RATE_LIMITED_WITH_RETRY } from "@/lib/constants/rate-limit";
import {
  EMAIL_CHANGE_CONFIRMED,
  EMAIL_CHANGE_INVALID_TOKEN,
  EMAIL_CHANGE_SENT,
  EMAIL_SAME_AS_CURRENT,
  NAME_UPDATED,
  PASSWORD_INCORRECT,
  SETTINGS_GENERIC_ERROR,
} from "@/lib/constants/settings-errors";
import { createTenantScopedClient, withoutTenantScope } from "@/lib/db";
import { actionError, actionSuccess } from "@/lib/errors";
import { inngest } from "@/lib/inngest/client";
import { logger } from "@/lib/logger";
import { maskEmail, maskIp } from "@/lib/pii";
import {
  checkRateLimit,
  getClientIp,
  requestEmailChangeLimiter,
  updateProfileLimiter,
  verifyEmailLimiter,
} from "@/lib/rateLimit";
import { requestEmailChangeSchema, updateProfileSchema } from "@/lib/validators/settings";

/** Email change token validity: 1 hour in milliseconds */
const EMAIL_CHANGE_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

/** Basic email format check for defensive validation before DB writes */
const BASIC_EMAIL_FORMAT = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Token format: base64url-encoded 32-byte string */
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{40,50}$/;

/**
 * Update the authenticated user's profile name.
 *
 * Rate limit → Validate → Auth → Execute (transaction: update user + event) → Return
 */
export async function updateProfile(formData: FormData) {
  // 1. Rate limit check (FIRST)
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const rateLimitResult = await checkRateLimit(updateProfileLimiter, ip);
  if (!rateLimitResult.allowed) {
    logger.warn("Rate limit exceeded for profile update", {
      endpoint: "updateProfile",
      limiter: "update-profile",
      ip: ip === "unknown" ? "unknown" : maskIp(ip),
      retryAfter: rateLimitResult.retryAfter,
    });
    return actionError(RATE_LIMITED_WITH_RETRY(rateLimitResult.retryAfter));
  }

  // 2. Validate input
  const parsed = updateProfileSchema.safeParse({
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return actionError(parsed.error.issues[0].message);
  }

  // 3. Auth check
  const session = await auth();
  if (!session?.user?.id || !session.user.accountId) {
    return actionError(SETTINGS_GENERIC_ERROR);
  }

  const { id: userId, accountId } = session.user;
  const prisma = createTenantScopedClient(accountId);

  try {
    // 4. Transaction: update user + create event
    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { name: parsed.data.name },
      });

      await tx.event.create({
        data: {
          type: EventType.SETTINGS_UPDATED,
          actorType: ActorType.USER,
          actorId: userId,
          targetType: "User",
          targetId: userId,
          accountId,
          payload: { field: "name", userId },
        },
      });

      return user;
    });

    logger.info("Profile updated", { userId, field: "name" });

    return actionSuccess({ name: updatedUser.name }, NAME_UPDATED);
  } catch (error) {
    logger.error("Profile update failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return actionError(SETTINGS_GENERIC_ERROR);
  }
}

/**
 * Request an email change. Sends a verification email to the new address.
 *
 * Rate limit → Validate → Auth → Verify password → Generate token →
 * Transaction (delete old tokens, create new token, set pendingEmail, event) →
 * Dispatch email → Return same success message regardless (enumeration prevention)
 */
export async function requestEmailChange(formData: FormData) {
  // 1. Rate limit check (FIRST)
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const rateLimitResult = await checkRateLimit(requestEmailChangeLimiter, ip);
  if (!rateLimitResult.allowed) {
    logger.warn("Rate limit exceeded for email change request", {
      endpoint: "requestEmailChange",
      limiter: "request-email-change",
      ip: ip === "unknown" ? "unknown" : maskIp(ip),
      retryAfter: rateLimitResult.retryAfter,
    });
    return actionError(RATE_LIMITED_WITH_RETRY(rateLimitResult.retryAfter));
  }

  // 2. Validate input
  const parsed = requestEmailChangeSchema.safeParse({
    newEmail: formData.get("newEmail"),
    currentPassword: formData.get("currentPassword"),
  });
  if (!parsed.success) {
    return actionError(parsed.error.issues[0].message);
  }

  // 3. Auth check
  const session = await auth();
  if (!session?.user?.id || !session.user.accountId) {
    return actionError(SETTINGS_GENERIC_ERROR);
  }

  const { id: userId, accountId } = session.user;
  const { newEmail, currentPassword } = parsed.data;

  try {
    // Use tenant-scoped client for user lookup
    const prisma = createTenantScopedClient(accountId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, passwordHash: true, name: true },
    });

    if (!user || !user.passwordHash) {
      return actionError(SETTINGS_GENERIC_ERROR);
    }

    // 4. Check new email differs from current (fast check before expensive bcrypt)
    if (newEmail === user.email) {
      return actionError(EMAIL_SAME_AS_CURRENT);
    }

    // 5. Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordMatch) {
      return actionError(PASSWORD_INCORRECT);
    }

    // 6. Generate token and hash it (pure crypto, no DB)
    const token = crypto.randomBytes(32).toString("base64url");
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // 7. Transaction: check uniqueness + cleanup old tokens + create new token + set pendingEmail + event
    // Uniqueness check is INSIDE the transaction to prevent race conditions where two
    // concurrent requests for the same new email both pass the check, then race on
    // token creation. The transaction serialises the check-then-write.
    const unscopedPrisma = withoutTenantScope();
    const emailTaken = await unscopedPrisma.$transaction(async (tx) => {
      // Check if new email is already taken (primary or pending by another user)
      const [existingPrimaryUser, existingPendingUser] = await Promise.all([
        tx.user.findUnique({
          where: { email: newEmail },
          select: { id: true },
        }),
        tx.user.findFirst({
          where: { pendingEmail: newEmail, id: { not: userId } },
          select: { id: true },
        }),
      ]);

      if (
        (existingPrimaryUser && existingPrimaryUser.id !== userId) ||
        existingPendingUser
      ) {
        logger.info("Email change request for already-taken email (silent skip)", {
          userId,
          newEmail: maskEmail(newEmail),
          takenBy: existingPrimaryUser ? "primary" : "pending",
        });
        return true; // Signal: email is taken, skip token creation
      }

      // Defensive check: verify email format before DB write (should never fail
      // since Zod validates at step 2, but guards against future code path bugs)
      if (!BASIC_EMAIL_FORMAT.test(newEmail)) {
        throw new Error(`Invalid email format for pendingEmail: ${maskEmail(newEmail)}`);
      }

      // Delete any existing tokens for the new email (cleanup)
      await tx.verificationToken.deleteMany({
        where: { identifier: newEmail },
      });

      // Create verification token with hashed token
      await tx.verificationToken.create({
        data: {
          identifier: newEmail,
          token: hashedToken,
          expires: new Date(Date.now() + EMAIL_CHANGE_TOKEN_EXPIRY_MS),
        },
      });

      // Set pendingEmail on user
      await tx.user.update({
        where: { id: userId },
        data: { pendingEmail: newEmail },
      });

      // Create audit event
      await tx.event.create({
        data: {
          type: EventType.SETTINGS_UPDATED,
          actorType: ActorType.USER,
          actorId: userId,
          targetType: "User",
          targetId: userId,
          accountId,
          payload: { field: "email_change_requested", userId },
        },
      });

      return false; // Email not taken, token created
    });

    // If email was taken, return same success message (enumeration prevention per AC3)
    if (emailTaken) {
      return actionSuccess({ message: EMAIL_CHANGE_SENT }, EMAIL_CHANGE_SENT);
    }

    // 9. Dispatch email via Inngest (failure-isolated)
    // TECH DEBT: If inngest.send() fails (network error, Inngest service down), the
    // user sees "Verification email sent" but no email was queued. Inngest retry logic
    // only works once the event reaches the queue; a failed send() call bypasses retries
    // entirely. For Pilot MVP this is acceptable (complete Inngest outage is rare), but
    // a future improvement should either: (1) fail the request when send() throws, or
    // (2) implement a background retry job for failed email dispatches.
    // TODO: Implement a background retry job for failed email dispatches.
    try {
      await inngest.send({
        name: "auth/email-change.requested",
        data: { email: newEmail, name: user.name ?? "", token },
      });
    } catch (inngestError) {
      logger.error("Failed to dispatch email change verification via Inngest", {
        userId,
        email: maskEmail(newEmail),
        error: inngestError instanceof Error ? inngestError.message : String(inngestError),
      });
    }

    logger.info("Email change requested", {
      userId,
      newEmail: maskEmail(newEmail),
    });

    // Same success message regardless of whether new email exists (enumeration prevention)
    return actionSuccess({ message: EMAIL_CHANGE_SENT }, EMAIL_CHANGE_SENT);
  } catch (error) {
    // Prisma P2002 = unique constraint violation. If the constraint is on
    // pending_email, another user raced and claimed the same pendingEmail.
    // Return same success message for email enumeration prevention.
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      logger.info("Email change request hit unique constraint (race condition, silent skip)", {
        userId,
        newEmail: maskEmail(newEmail),
      });
      return actionSuccess({ message: EMAIL_CHANGE_SENT }, EMAIL_CHANGE_SENT);
    }

    logger.error("Email change request failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return actionError(SETTINGS_GENERIC_ERROR);
  }
}

/**
 * Confirm an email change using the verification token from the email.
 *
 * Rate limit → Validate token format → Hash token → Look up →
 * Find user with matching pendingEmail →
 * Transaction (update email, clear pendingEmail, set emailVerified, delete token,
 *   destroy sessions, create event) → Return
 *
 * Uses withoutTenantScope() because the user may not have an active session
 * (they might click the link in a different browser).
 */
export async function confirmEmailChange(token: string) {
  // 1. Rate limit check (FIRST) — reuses verifyEmailLimiter
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const rateLimitResult = await checkRateLimit(verifyEmailLimiter, ip);
  if (!rateLimitResult.allowed) {
    logger.warn("Rate limit exceeded for email change confirmation", {
      endpoint: "confirmEmailChange",
      limiter: "verify-email",
      ip: ip === "unknown" ? "unknown" : maskIp(ip),
      retryAfter: rateLimitResult.retryAfter,
    });
    return actionError(RATE_LIMITED_WITH_RETRY(rateLimitResult.retryAfter));
  }

  // 2. Validate token format
  if (!token || !TOKEN_FORMAT.test(token)) {
    return actionError(EMAIL_CHANGE_INVALID_TOKEN);
  }

  const prisma = withoutTenantScope();

  try {
    // 3. Hash incoming token and look up
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const tokenRecord = await prisma.verificationToken.findUnique({
      where: { token: hashedToken },
    });

    if (!tokenRecord) {
      return actionError(EMAIL_CHANGE_INVALID_TOKEN);
    }

    // 4. Check token expiry — same generic error (security)
    // TECH DEBT: If the delete below fails, the expired token remains in the DB.
    // A background cleanup job should periodically purge expired VerificationTokens.
    // TODO: Implement a background cleanup job for expired verification tokens.
    if (tokenRecord.expires < new Date()) {
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: tokenRecord.identifier,
            token: tokenRecord.token,
          },
        },
      }).catch(() => {
        logger.warn("Failed to delete expired email change token — stale row remains", {
          identifier: maskEmail(tokenRecord.identifier),
        });
      });
      return actionError(EMAIL_CHANGE_INVALID_TOKEN);
    }

    // 5. Find user with pendingEmail matching token's identifier
    const user = await prisma.user.findFirst({
      where: { pendingEmail: tokenRecord.identifier },
    });

    if (!user) {
      return actionError(EMAIL_CHANGE_INVALID_TOKEN);
    }

    // 6. Transaction: update email, clear pendingEmail, set emailVerified,
    //    delete token, destroy sessions, create event
    await prisma.$transaction(async (tx) => {
      // Update user email
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: tokenRecord.identifier,
          pendingEmail: null,
          emailVerified: new Date(),
        },
      });

      // Delete used token
      await tx.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: tokenRecord.identifier,
            token: tokenRecord.token,
          },
        },
      });

      // Destroy ALL sessions — force re-login with new email (security)
      // MANDATORY: if this fails, the email change must roll back
      const destroyedSessions = await tx.session.deleteMany({
        where: { userId: user.id },
      });

      if (destroyedSessions.count === 0) {
        logger.warn("Email change confirmed but zero sessions destroyed — possible stale session state", {
          userId: user.id,
        });
      }

      // Create audit event
      await tx.event.create({
        data: {
          type: EventType.SETTINGS_UPDATED,
          actorType: ActorType.USER,
          actorId: user.id,
          targetType: "User",
          targetId: user.id,
          accountId: user.accountId,
          payload: { field: "email_confirmed", userId: user.id },
        },
      });
    });

    logger.info("Email change confirmed", {
      userId: user.id,
      newEmail: maskEmail(tokenRecord.identifier),
    });

    return actionSuccess(
      { message: EMAIL_CHANGE_CONFIRMED },
      EMAIL_CHANGE_CONFIRMED,
    );
  } catch (error) {
    logger.error("Email change confirmation failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return actionError(SETTINGS_GENERIC_ERROR);
  }
}

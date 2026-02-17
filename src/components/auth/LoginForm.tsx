"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";

import { loginUser } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GENERIC_ERROR,
  isRateLimitMessage,
  LOGIN_EMAIL_NOT_VERIFIED,
  LOGIN_NETWORK_ERROR,
  SAFE_LOGIN_MESSAGES,
} from "@/lib/constants/auth-errors";
import type { ActionResult } from "@/lib/errors";

const initialState: ActionResult<{ redirectTo: string }> = { success: false };

/**
 * Sanitize error messages to prevent leaking internal details.
 * Only known safe messages (from shared auth-errors constants) are shown;
 * all others get a generic fallback.
 */
function sanitizeError(error: string | undefined): string | undefined {
  if (!error) return undefined;
  if (SAFE_LOGIN_MESSAGES.has(error) || isRateLimitMessage(error)) return error;
  return GENERIC_ERROR;
}

async function handleLogin(
  _prevState: ActionResult<{ redirectTo: string }>,
  formData: FormData,
): Promise<ActionResult<{ redirectTo: string }>> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    const result = await loginUser({ email, password });
    if (!result.success && result.error) {
      return { ...result, error: sanitizeError(result.error) };
    }
    return result;
  } catch {
    return {
      success: false,
      error: LOGIN_NETWORK_ERROR,
    };
  }
}

export function LoginForm() {
  const [state, action, isPending] = useActionState(handleLogin, initialState);
  const router = useRouter();
  const passwordRef = useRef<HTMLInputElement>(null);

  // Redirect to dashboard on successful login
  useEffect(() => {
    if (state.success && state.data) {
      router.push(state.data.redirectTo);
    }
  }, [state.success, state.data, router]);

  // Clear password field on error (preserve email)
  useEffect(() => {
    if (state.error && passwordRef.current) {
      passwordRef.current.value = "";
    }
  }, [state.error]);

  const isUnverified = state.error === LOGIN_EMAIL_NOT_VERIFIED;
  const isDisabled = isPending || state.success;

  return (
    // CSRF protection: Next.js 15+ server actions have built-in CSRF protection
    // via Origin header validation. No explicit CSRF tokens needed for <form action={serverAction}>.
    // If these forms are ever refactored to use route handlers (/api/auth/login),
    // explicit CSRF tokens MUST be added.
    <form action={action} className="space-y-4">
      {state.error && !isUnverified && (
        <div
          id="form-error"
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      {isUnverified && (
        <div
          id="form-error"
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          <p>Please verify your email before logging in.</p>
          <Link
            href="/check-email"
            className="mt-1 inline-block text-primary underline-offset-4 hover:underline"
          >
            Resend verification email
          </Link>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          aria-required="true"
          aria-describedby={state.error ? "form-error" : undefined}
          autoComplete="email"
          disabled={isDisabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          ref={passwordRef}
          id="password"
          name="password"
          type="password"
          required
          aria-required="true"
          aria-describedby={state.error ? "form-error" : undefined}
          autoComplete="current-password"
          disabled={isDisabled}
        />
      </div>

      <Button
        type="submit"
        className="min-h-[48px] w-full"
        disabled={isDisabled}
      >
        <span aria-live="polite">
          {isPending ? "Signing in..." : state.success ? "Redirecting..." : "Sign in"}
        </span>
      </Button>
    </form>
  );
}

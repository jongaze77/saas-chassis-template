"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";

import { resetPassword } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GENERIC_ERROR,
  isRateLimitMessage,
  PASSWORD_RESET_INVALID_TOKEN,
  PASSWORD_RESET_NETWORK_ERROR,
  SAFE_PASSWORD_RESET_MESSAGES,
} from "@/lib/constants/auth-errors";
import type { ActionResult } from "@/lib/errors";

interface ResetPasswordFormProps {
  token: string;
}

const initialState: ActionResult<{ redirectTo: string }> = { success: false };

function sanitizeError(error: string | undefined): string | undefined {
  if (!error) return undefined;
  if (SAFE_PASSWORD_RESET_MESSAGES.has(error) || isRateLimitMessage(error)) return error;
  return GENERIC_ERROR;
}

function isTokenError(error: string | undefined): boolean {
  return error === PASSWORD_RESET_INVALID_TOKEN;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter();
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleResetPassword(
    _prevState: ActionResult<{ redirectTo: string }>,
    formData: FormData,
  ): Promise<ActionResult<{ redirectTo: string }>> {
    const password = formData.get("password") as string;

    try {
      const result = await resetPassword({ token, password });
      if (!result.success && result.error) {
        return { ...result, error: sanitizeError(result.error) };
      }
      return result;
    } catch {
      return {
        success: false,
        error: PASSWORD_RESET_NETWORK_ERROR,
      };
    }
  }

  const [state, action, isPending] = useActionState(handleResetPassword, initialState);

  // Redirect to login on success
  useEffect(() => {
    if (state.success && state.data) {
      router.push(state.data.redirectTo);
    }
  }, [state.success, state.data, router]);

  // Clear password field on error
  useEffect(() => {
    if (state.error && passwordRef.current) {
      passwordRef.current.value = "";
    }
  }, [state.error]);

  const tokenError = isTokenError(state.error);
  const isDisabled = isPending || state.success;

  return (
    <form action={action} className="space-y-4">
      {state.error && !tokenError && (
        <div
          id="validation-error"
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      {tokenError && (
        <div
          id="token-error"
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <p>{state.error}</p>
          <Link
            href="/forgot-password"
            className="mt-1 inline-block text-primary underline-offset-4 hover:underline"
          >
            Request a new reset link
          </Link>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          ref={passwordRef}
          id="password"
          name="password"
          type="password"
          required
          aria-required="true"
          aria-describedby={
            state.error
              ? tokenError ? "token-error" : "validation-error"
              : undefined
          }
          autoComplete="new-password"
          disabled={isDisabled || tokenError}
        />
      </div>

      <Button
        type="submit"
        className="min-h-[48px] w-full"
        disabled={isDisabled || tokenError}
      >
        <span aria-live="polite">
          {isPending ? "Resetting..." : state.success ? "Redirecting..." : "Reset password"}
        </span>
      </Button>
    </form>
  );
}

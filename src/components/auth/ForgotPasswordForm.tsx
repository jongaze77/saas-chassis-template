"use client";

import Link from "next/link";
import { useActionState } from "react";

import { requestPasswordReset } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GENERIC_ERROR,
  isRateLimitMessage,
  PASSWORD_RESET_CONFIRMATION,
  PASSWORD_RESET_NETWORK_ERROR,
  SAFE_PASSWORD_RESET_REQUEST_MESSAGES,
} from "@/lib/constants/auth-errors";
import type { ActionResult } from "@/lib/errors";

const initialState: ActionResult<{ sent: boolean }> = { success: false };

function sanitizeError(error: string | undefined): string | undefined {
  if (!error) return undefined;
  if (SAFE_PASSWORD_RESET_REQUEST_MESSAGES.has(error) || isRateLimitMessage(error)) return error;
  return GENERIC_ERROR;
}

async function handleRequestReset(
  _prevState: ActionResult<{ sent: boolean }>,
  formData: FormData,
): Promise<ActionResult<{ sent: boolean }>> {
  const email = formData.get("email") as string;

  try {
    const result = await requestPasswordReset({ email });
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

export function ForgotPasswordForm() {
  const [state, action, isPending] = useActionState(handleRequestReset, initialState);

  // On success, replace the form with the confirmation message
  if (state.success) {
    return (
      <div
        role="status"
        className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
      >
        <p>{state.warning ?? PASSWORD_RESET_CONFIRMATION}</p>
        <Link
          href="/login"
          className="mt-2 inline-block text-primary underline-offset-4 hover:underline"
        >
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <div
          id="form-error"
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {state.error}
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
          disabled={isPending}
        />
      </div>

      <Button
        type="submit"
        className="min-h-[48px] w-full"
        disabled={isPending}
      >
        <span aria-live="polite">
          {isPending ? "Sending..." : "Send reset link"}
        </span>
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Remember your password?{" "}
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

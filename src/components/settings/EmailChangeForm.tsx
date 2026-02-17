"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { requestEmailChange } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isRateLimitMessage,
  isSettingsMessage,
  SETTINGS_GENERIC_ERROR,
} from "@/lib/constants/settings-errors";
import type { ActionResult } from "@/lib/errors";

interface EmailChangeFormProps {
  currentEmail: string;
  pendingEmail: string | null;
}

const initialState: ActionResult<{ message: string }> = { success: false };

function sanitizeError(error: string | undefined): string | undefined {
  if (!error) return undefined;
  if (isSettingsMessage(error) || isRateLimitMessage(error)) return error;
  return SETTINGS_GENERIC_ERROR;
}

async function handleRequestEmailChange(
  _prevState: ActionResult<{ message: string }>,
  formData: FormData,
): Promise<ActionResult<{ message: string }>> {
  try {
    const result = await requestEmailChange(formData);
    if (!result.success && result.error) {
      return { ...result, error: sanitizeError(result.error) };
    }
    return result;
  } catch {
    return {
      success: false,
      error: SETTINGS_GENERIC_ERROR,
    };
  }
}

export function EmailChangeForm({ currentEmail, pendingEmail }: EmailChangeFormProps) {
  const [state, action, isPending] = useActionState(handleRequestEmailChange, initialState);
  const router = useRouter();

  // After a successful email change request, refresh server data so that the
  // pendingEmail prop stays in sync if the user navigates away and returns.
  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  // Show pending banner if there's a pending email change (from props or just submitted)
  const showPendingBanner = state.success || pendingEmail;

  return (
    <div className="space-y-4">
      {showPendingBanner && (
        <div
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          {state.success
            ? state.warning
            : `Verification email sent to ${pendingEmail}. Check your inbox.`}
        </div>
      )}

      {!state.success && state.error && (
        <div
          id="email-change-error"
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email-current">Current email</Label>
          <Input
            id="email-current"
            type="email"
            value={currentEmail}
            disabled
            className="bg-muted"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email-new">New email</Label>
          <Input
            id="email-new"
            name="newEmail"
            type="email"
            required
            aria-required="true"
            aria-describedby={!state.success && state.error ? "email-change-error" : undefined}
            autoComplete="email"
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email-password">Current password</Label>
          <Input
            id="email-password"
            name="currentPassword"
            type="password"
            required
            aria-required="true"
            aria-describedby={!state.success && state.error ? "email-change-error" : undefined}
            autoComplete="current-password"
            disabled={isPending}
          />
          <p className="text-xs text-muted-foreground">
            Required to confirm your identity.
          </p>
        </div>

        <Button
          type="submit"
          className="min-h-[48px]"
          disabled={isPending}
        >
          <span aria-live="polite">
            {isPending ? "Sending..." : "Change email"}
          </span>
        </Button>
      </form>
    </div>
  );
}

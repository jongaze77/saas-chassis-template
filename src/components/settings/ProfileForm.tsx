"use client";

import { useActionState } from "react";

import { updateProfile } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isRateLimitMessage,
  isSettingsMessage,
  SETTINGS_GENERIC_ERROR,
} from "@/lib/constants/settings-errors";
import type { ActionResult } from "@/lib/errors";

interface ProfileFormProps {
  userName: string | null;
  userEmail: string;
}

const initialState: ActionResult<{ name: string | null }> = { success: false };

function sanitizeError(error: string | undefined): string | undefined {
  if (!error) return undefined;
  if (isSettingsMessage(error) || isRateLimitMessage(error)) return error;
  return SETTINGS_GENERIC_ERROR;
}

async function handleUpdateProfile(
  _prevState: ActionResult<{ name: string | null }>,
  formData: FormData,
): Promise<ActionResult<{ name: string | null }>> {
  try {
    const result = await updateProfile(formData);
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

export function ProfileForm({ userName, userEmail }: ProfileFormProps) {
  const [state, action, isPending] = useActionState(handleUpdateProfile, initialState);

  // Use updated name from success response, otherwise fall back to prop.
  // Normalize to empty string so downstream code doesn't need null checks.
  const displayName = (state.success && state.data?.name != null ? state.data.name : userName) ?? "";

  return (
    <form action={action} className="space-y-4">
      {state.success && state.warning && (
        <div
          role="status"
          className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
        >
          {state.warning}
        </div>
      )}

      {!state.success && state.error && (
        <div
          id="profile-error"
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="profile-email">Email</Label>
        <Input
          id="profile-email"
          type="email"
          value={userEmail}
          disabled
          className="bg-muted"
        />
        <p className="text-xs text-muted-foreground">
          To change your email, use the email change section below.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-name">Name</Label>
        <Input
          id="profile-name"
          name="name"
          type="text"
          defaultValue={displayName}
          required
          aria-required="true"
          aria-describedby={!state.success && state.error ? "profile-error" : undefined}
          disabled={isPending}
          maxLength={100}
        />
      </div>

      <Button
        type="submit"
        className="min-h-[48px]"
        disabled={isPending}
      >
        <span aria-live="polite">
          {isPending ? "Saving..." : "Save changes"}
        </span>
      </Button>
    </form>
  );
}

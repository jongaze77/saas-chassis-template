"use client";

import { useActionState } from "react";

import { resendVerification } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/errors";

const initialState: ActionResult<{ sent: boolean }> = { success: false };

async function handleResend(
  _prevState: ActionResult<{ sent: boolean }>,
  formData: FormData,
) {
  const email = formData.get("email") as string;
  return resendVerification({ email });
}

export function ResendVerificationForm({
  defaultEmail,
}: {
  defaultEmail?: string;
}) {
  const [state, action, isPending] = useActionState(handleResend, initialState);

  if (state.success) {
    return (
      <p className="text-sm text-muted-foreground">
        If an account exists with that email, a new verification link has been sent.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      {state.error && (
        <div
          id="resend-form-error"
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="resend-email">Email address</Label>
        <Input
          id="resend-email"
          name="email"
          type="email"
          required
          aria-required="true"
          aria-describedby={state.error ? "resend-form-error" : undefined}
          defaultValue={defaultEmail}
          autoComplete="email"
          disabled={isPending}
        />
      </div>

      <Button type="submit" variant="outline" className="w-full" disabled={isPending}>
        {isPending ? "Sending..." : "Resend verification email"}
      </Button>
    </form>
  );
}

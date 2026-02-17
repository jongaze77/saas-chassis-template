"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";

import { registerUser } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/errors";

const initialState: ActionResult<{ email: string }> = { success: false };

async function handleRegister(
  _prevState: ActionResult<{ email: string }>,
  formData: FormData,
): Promise<ActionResult<{ email: string }>> {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    return await registerUser({ name, email, password });
  } catch {
    // Network errors or server action failures — form inputs are preserved
    // by the browser since they are uncontrolled
    return {
      success: false,
      error: "Unable to connect to the server. Please check your connection and try again.",
    };
  }
}

export function RegisterForm() {
  const [state, action, isPending] = useActionState(handleRegister, initialState);
  const router = useRouter();
  const passwordRef = useRef<HTMLInputElement>(null);

  // Redirect to check-email page on successful registration
  useEffect(() => {
    if (state.success && state.data) {
      const params = new URLSearchParams({ email: state.data.email });
      if (state.warning) {
        params.set("emailWarning", "true");
      }
      router.push(`/check-email?${params.toString()}`);
    }
  }, [state.success, state.data, state.warning, router]);

  // AC4: Clear password field on error (preserve other inputs, not password)
  useEffect(() => {
    if (state.error && passwordRef.current) {
      passwordRef.current.value = "";
    }
  }, [state.error]);

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
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          aria-required="true"
          aria-describedby={state.error ? "form-error" : undefined}
          autoComplete="name"
          disabled={isPending}
        />
      </div>

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

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          ref={passwordRef}
          id="password"
          name="password"
          type="password"
          required
          aria-required="true"
          aria-describedby={
            state.error ? "password-hint form-error" : "password-hint"
          }
          minLength={8}
          autoComplete="new-password"
          disabled={isPending}
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          Must be at least 8 characters
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}

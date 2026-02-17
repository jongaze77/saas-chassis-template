"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { logoutUser } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  GENERIC_ERROR,
  LOGOUT_NETWORK_ERROR,
  SAFE_LOGOUT_MESSAGES,
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
  return SAFE_LOGOUT_MESSAGES.has(error) ? error : GENERIC_ERROR;
}

async function handleLogout(
  _previousState: ActionResult<{ redirectTo: string }>, // eslint-disable-line @typescript-eslint/no-unused-vars -- required by useActionState signature
): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const result = await logoutUser();
    if (!result.success && result.error) {
      return { ...result, error: sanitizeError(result.error) };
    }
    return result;
  } catch {
    return {
      success: false,
      error: LOGOUT_NETWORK_ERROR,
    };
  }
}

export function LogoutButton() {
  const [state, action, isPending] = useActionState(handleLogout, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.success && state.data) {
      router.push(state.data.redirectTo);
    }
  }, [state.success, state.data, router]);

  // Prevent double-click during the window between action completion and redirect
  const isDisabled = isPending || state.success;

  return (
    <div>
      {state.error && (
        <div
          role="alert"
          className="mb-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}
      {/* CSRF protection: Next.js 15+ server actions validate Origin header automatically.
          If refactored to route handler, add explicit CSRF tokens. */}
      <form action={action}>
        <Button
          type="submit"
          variant="outline"
          className="min-h-[48px]"
          disabled={isDisabled}
        >
          <span aria-live="polite">
            {isPending ? "Logging out..." : "Log out"}
          </span>
        </Button>
      </form>
    </div>
  );
}

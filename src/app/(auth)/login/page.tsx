import Link from "next/link";

import { LoginForm } from "@/components/auth/LoginForm";
import { PASSWORD_RESET_SUCCESS } from "@/lib/constants/auth-errors";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; expired?: string; reset?: string }>;
}) {
  const { verified, expired, reset } = await searchParams;

  return (
    <div className="space-y-6">
      {verified === "true" && (
        <div
          role="status"
          className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
        >
          Email verified! You can now sign in.
        </div>
      )}

      {expired === "true" && (
        <div
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          Your session has expired. Please log in again.
        </div>
      )}

      {reset === "true" && (
        <div
          role="status"
          className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
        >
          {PASSWORD_RESET_SUCCESS}
        </div>
      )}

      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Login</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your account
        </p>
      </div>

      <LoginForm />

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/forgot-password" className="text-primary underline-offset-4 hover:underline">
          Forgot your password?
        </Link>
      </p>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-primary underline-offset-4 hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}

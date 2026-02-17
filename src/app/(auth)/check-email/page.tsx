import type { Metadata } from "next";

import { ResendVerificationForm } from "@/components/auth/ResendVerificationForm";
import { appConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: `Check your email - ${appConfig.name}`,
  description: "Verify your email address to complete registration",
};

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; emailWarning?: string }>;
}) {
  const { email, emailWarning } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          We&apos;ve sent a verification link to{" "}
          {email ? (
            <span className="font-medium text-foreground">{email}</span>
          ) : (
            "your email address"
          )}
          . Click the link to verify your account.
        </p>
      </div>

      {emailWarning && (
        <div
          role="alert"
          className="rounded-md border border-yellow-500/50 bg-yellow-50 p-4 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200"
        >
          <p>
            We had trouble sending the verification email. Please click
            &ldquo;Resend&rdquo; below to try again.
          </p>
        </div>
      )}

      <div className="rounded-md border bg-muted/50 p-4 text-sm text-muted-foreground">
        <p>The link will expire in 24 hours. Check your spam folder if you don&apos;t see it.</p>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Didn&apos;t receive the email?
        </p>
        <ResendVerificationForm defaultEmail={email} />
      </div>
    </div>
  );
}

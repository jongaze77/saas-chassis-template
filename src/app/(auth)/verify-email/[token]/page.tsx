import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { verifyEmail } from "@/actions/auth";
import { ResendVerificationForm } from "@/components/auth/ResendVerificationForm";

export const metadata: Metadata = {
  title: "Verify Email - SEO PluginPress",
  description: "Email verification",
};

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await verifyEmail(token);

  if (result.success) {
    redirect("/login?verified=true");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Verification failed</h1>
        <p className="text-sm text-destructive">{result.error}</p>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Enter your email to receive a new verification link:
        </p>
        <ResendVerificationForm />
      </div>
    </div>
  );
}

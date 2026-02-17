import type { Metadata } from "next";
import Link from "next/link";

import { confirmEmailChange } from "@/actions/settings";
import { appConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: `Confirm Email Change - ${appConfig.name}`,
  description: `Confirm your email address change for ${appConfig.name}`,
};

export default async function ConfirmEmailChangePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await confirmEmailChange(token);

  if (result.success) {
    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Email updated</h1>
          <p className="text-sm text-muted-foreground">
            {result.warning || "Your email address has been updated successfully."}
          </p>
        </div>

        <div className="text-center">
          <Link
            href="/login"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Log in with your new email
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Verification failed</h1>
        <p className="text-sm text-destructive">{result.error}</p>
      </div>

      <div className="text-center">
        <Link
          href="/settings"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Back to settings
        </Link>
      </div>
    </div>
  );
}

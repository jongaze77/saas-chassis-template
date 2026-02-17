import type { Metadata } from "next";

import { auth } from "@/lib/auth";
import { appConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: `Dashboard | ${appConfig.name}`,
};

export default async function DashboardPage() {
  // auth() is request-deduplicated by NextAuth v5 (uses React.cache internally),
  // so this does NOT cause a redundant database call even though the layout also
  // calls auth(). Next.js layouts cannot pass props to page children, so calling
  // auth() in each Server Component that needs session data is the canonical pattern.
  const session = await auth();
  const userName = session?.user?.name;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        {userName ? `Welcome back, ${userName}` : "Welcome"}
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
          <h3 className="text-lg font-semibold">Get Started</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Welcome to your new application. Start building your features here.
          </p>
        </div>
      </div>
    </div>
  );
}

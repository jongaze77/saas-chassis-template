import { Activity, Globe, ListChecks } from "lucide-react";
import type { Metadata } from "next";

import { EmptyDashboardCard } from "@/components/dashboard/EmptyDashboardCard";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Dashboard | SEO PluginPress",
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
        <EmptyDashboardCard
          icon={ListChecks}
          title="Priority Actions"
          description="Your prioritised triage recommendations will appear here once your sites are analysed."
          actionLabel="View Triage"
          actionHref="/triage"
        />
        <EmptyDashboardCard
          icon={Globe}
          title="Connected Sites"
          description="No sites connected yet — Connect your first WordPress site to get started."
          actionLabel="Connect a Site"
          actionHref="/sites"
        />
        <EmptyDashboardCard
          icon={Activity}
          title="Recent Activity"
          description="Your team's recent actions and platform activity will appear here."
          actionLabel="View Activity"
          actionHref="/activity"
        />
      </div>
    </div>
  );
}

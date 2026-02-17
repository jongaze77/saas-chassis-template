import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountDetails } from "@/components/settings/AccountDetails";
import { EmailChangeForm } from "@/components/settings/EmailChangeForm";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { TeamMembersList } from "@/components/settings/TeamMembersList";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { appConfig } from "@/lib/config";
import { createTenantScopedClient } from "@/lib/db";

export const metadata: Metadata = {
  title: `Account Settings | ${appConfig.name}`,
};

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.id || !session.user.accountId) {
    redirect("/login?expired=true");
  }

  const { id: userId, accountId } = session.user;
  const prisma = createTenantScopedClient(accountId);

  // Fetch user profile, account details, and team members in parallel
  const [user, account, teamMembers] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, pendingEmail: true },
    }),
    prisma.account.findUnique({
      where: { id: accountId },
      select: { name: true, createdAt: true },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true, lastSeenAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!user || !account) {
    redirect("/login?expired=true");
  }

  return (
    <div className="space-y-6 max-w-[800px]">
      <h1 className="text-2xl font-bold">Account Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Manage your personal information.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            userName={user.name}
            userEmail={user.email}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Email</CardTitle>
          <CardDescription>
            Update your email address. A verification email will be sent to the new address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailChangeForm
            currentEmail={user.email}
            pendingEmail={user.pendingEmail}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>Information about your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <AccountDetails
            accountName={account.name}
            createdAt={account.createdAt}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>People on your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <TeamMembersList
            members={teamMembers}
            currentUserId={userId}
          />
        </CardContent>
      </Card>
    </div>
  );
}

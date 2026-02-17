"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/formatters";

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  lastSeenAt: Date | null;
}

interface TeamMembersListProps {
  members: TeamMember[];
  currentUserId: string;
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const trimmed = name.trim();
    if (!trimmed) return email[0]?.toUpperCase() || "?";
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return trimmed[0].toUpperCase();
  }
  return email[0]?.toUpperCase() || "?";
}

export function TeamMembersList({ members, currentUserId }: TeamMembersListProps) {
  if (members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No team members found.</p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop: table layout */}
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2 font-medium text-muted-foreground">Member</th>
              <th className="pb-2 font-medium text-muted-foreground">Email</th>
              <th className="pb-2 font-medium text-muted-foreground">Role</th>
              <th className="pb-2 font-medium text-muted-foreground">Last active</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b last:border-0">
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {getInitials(member.name, member.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span>
                      {member.name || member.email}
                      {member.id === currentUserId && (
                        <span className="ml-1 text-xs text-muted-foreground">(You)</span>
                      )}
                    </span>
                  </div>
                </td>
                <td className="py-3 text-muted-foreground">{member.email}</td>
                <td className="py-3">Owner</td>
                <td className="py-3 text-muted-foreground">
                  {formatRelativeTime(member.lastSeenAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: card layout */}
      <div className="space-y-3 md:hidden">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-start gap-3 rounded-md border p-3"
          >
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="text-xs">
                {getInitials(member.name, member.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {member.name || member.email}
                {member.id === currentUserId && (
                  <span className="ml-1 text-xs text-muted-foreground">(You)</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground truncate">{member.email}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>Owner</span>
                <span aria-hidden="true">&middot;</span>
                <span>{formatRelativeTime(member.lastSeenAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Team members are managed by the account owner.
      </p>
    </div>
  );
}

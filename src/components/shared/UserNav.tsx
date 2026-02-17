"use client";

import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useTransition } from "react";

import { logoutUser } from "@/actions/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface UserNavProps {
  userName: string | null | undefined;
  userEmail: string | null | undefined;
}

/**
 * Extract the first character of a string, handling multi-byte characters
 * (CJK, emoji, etc.) correctly via string iteration.
 */
function firstChar(str: string): string {
  for (const char of str) {
    return char;
  }
  return "";
}

/**
 * Extract user initials: first + last name initials (e.g., "John Smith" → "JS"),
 * single name initial (e.g., "John" → "J"), or email first char as fallback.
 * Handles CJK and other non-Latin scripts correctly — names without spaces
 * return a single character; names with spaces use first + last word initials.
 */
export function getInitials(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (firstChar(parts[0]) + firstChar(parts[parts.length - 1])).toUpperCase();
    }
    return firstChar(parts[0]).toUpperCase();
  }
  if (email) {
    return firstChar(email).toUpperCase();
  }
  return "U";
}

export function UserNav({ userName, userEmail }: UserNavProps) {
  const router = useRouter();
  const { isMobile } = useSidebar();
  const [isPending, startTransition] = useTransition();
  const [hasMounted, setHasMounted] = React.useState(false);

  React.useEffect(() => {
    setHasMounted(true);
  }, []);

  const initials = React.useMemo(
    () => getInitials(userName, userEmail),
    [userName, userEmail],
  );
  const displayName = userName || "User";
  const displayEmail = userEmail || "No email";

  // Use "bottom" as safe default during SSR/hydration to avoid layout shift.
  // After mount, use the actual viewport-aware value from useSidebar.
  // Note: Radix DropdownMenuContent only renders via Portal when open (user click),
  // which can't happen before useEffect fires, so hasMounted is always true by then.
  // This guard is purely defensive for SSR consistency.
  const dropdownSide = hasMounted && !isMobile ? "right" : "bottom";

  const handleLogout = React.useCallback(() => {
    startTransition(async () => {
      await logoutUser();
      router.push("/login");
    });
  }, [router, startTransition]);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{displayName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {displayEmail}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={dropdownSide}
            align="end"
            sideOffset={4}
            // Prevent dropdown flash during hasMounted transition. Radix renders
            // the portal only when open (user click), which requires mount — but
            // this guard ensures correct positioning even in edge cases.
            style={hasMounted ? undefined : { visibility: "hidden" }}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{displayName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {displayEmail}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="min-h-[48px]">
              <Link href="/settings">
                <Settings />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="min-h-[48px]"
              onClick={handleLogout}
              disabled={isPending}
            >
              <LogOut />
              {isPending ? "Logging out..." : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

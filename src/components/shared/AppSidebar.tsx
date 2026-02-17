"use client";

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ClipboardList,
  Globe,
  LayoutDashboard,
  ListChecks,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";

import { UserNav } from "@/components/shared/UserNav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

const TABLET_MIN = 768;
const TABLET_MAX = 1023;

const baseNavItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Triage", url: "/triage", icon: ListChecks },
  { title: "Sites", url: "/sites", icon: Globe },
  { title: "Activity", url: "/activity", icon: Activity },
  { title: "Settings", url: "/settings", icon: Settings },
];

interface AppSidebarProps {
  userName: string | null | undefined;
  userEmail: string | null | undefined;
  showAssignments?: boolean;
  /** When false (no cookie), collapse sidebar on tablet viewport per AC3 */
  hasCookiePreference?: boolean;
}

export function AppSidebar({
  userName,
  userEmail,
  showAssignments = false,
  hasCookiePreference = true,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { state, setOpen } = useSidebar();
  const isCollapsed = state === "collapsed";
  const hasAppliedTabletDefault = useRef(false);

  // AC3: On first visit (no cookie), collapse sidebar on tablet viewport (768-1023px).
  // This runs once on mount. After the user interacts, cookie persistence takes over.
  // Uses matchMedia instead of window.innerWidth for accurate viewport detection
  // (accounts for scrollbar width on Windows/Linux with classic scrollbars).
  // Note: AppSidebar lives in the layout, so it persists across page navigations
  // (only layout children remount). The ref survives the entire dashboard session.
  useEffect(() => {
    if (hasCookiePreference || hasAppliedTabletDefault.current) {
      return;
    }
    hasAppliedTabletDefault.current = true;
    const isTablet = window.matchMedia(
      `(min-width: ${TABLET_MIN}px) and (max-width: ${TABLET_MAX}px)`,
    ).matches;
    if (isTablet) {
      setOpen(false);
    }
    // Note: Only depends on hasCookiePreference (stable server prop) and setOpen
    // (stable context). We intentionally omit `state` — this is a one-time tablet
    // default applied on mount, not a reactive sidebar state watcher.
  }, [hasCookiePreference, setOpen]);

  const navItems = useMemo(() => {
    const items = [...baseNavItems];
    if (showAssignments) {
      // Insert Assignments before Settings. Use findIndex for position-safe
      // insertion that survives nav item reordering.
      const settingsIndex = items.findIndex((item) => item.title === "Settings");
      const insertAt = settingsIndex >= 0 ? settingsIndex : items.length;
      items.splice(insertAt, 0, {
        title: "Assignments",
        url: "/assignments",
        icon: ClipboardList,
      });
    }
    return items;
  }, [showAssignments]);

  return (
    <Sidebar variant="sidebar" collapsible="icon" side="left">
      <SidebarHeader className="border-b">
        <div className="flex h-10 items-center gap-2 px-2">
          {isCollapsed ? (
            <span className="text-lg font-bold text-sidebar-primary">SP</span>
          ) : (
            <span className="text-lg font-semibold text-sidebar-foreground">
              SEO PluginPress
            </span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.url}
                  tooltip={item.title}
                >
                  <Link href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserNav userName={userName} userEmail={userEmail} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

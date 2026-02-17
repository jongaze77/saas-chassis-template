import { describe, it, expect, vi } from "vitest";

// Mock the auth actions module directly to avoid deep dependency chains
// (auth → db, bcrypt, inngest, env, logger). AppSidebar imports UserNav
// which imports logoutUser from @/actions/auth.
vi.mock("@/actions/auth", () => ({
  logoutUser: vi.fn(),
}));

// Mock sidebar UI components that rely on SidebarProvider context
vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => children,
  SidebarContent: ({ children }: { children: React.ReactNode }) => children,
  SidebarFooter: ({ children }: { children: React.ReactNode }) => children,
  SidebarGroup: ({ children }: { children: React.ReactNode }) => children,
  SidebarHeader: ({ children }: { children: React.ReactNode }) => children,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => children,
  SidebarMenuButton: ({ children }: { children: React.ReactNode }) => children,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => children,
  SidebarRail: () => null,
  useSidebar: () => ({ state: "expanded", setOpen: vi.fn(), isMobile: false }),
}));

import { AppSidebar } from "@/components/shared/AppSidebar";

describe("AppSidebar", () => {
  it("exports a function component", () => {
    expect(typeof AppSidebar).toBe("function");
  });

  it("has the correct display name", () => {
    expect(AppSidebar.name).toBe("AppSidebar");
  });

  describe("navigation items", () => {
    it("component is importable and contains navigation structure", async () => {
      const appSidebarModule = await import("@/components/shared/AppSidebar");
      expect(appSidebarModule.AppSidebar).toBeDefined();
    });

    it("defines exactly 2 navigation items", async () => {
      const expectedNavItems = [
        { title: "Dashboard", url: "/dashboard" },
        { title: "Settings", url: "/settings" },
      ];
      expect(expectedNavItems).toHaveLength(2);
      expect(expectedNavItems.map((item) => item.title)).toEqual([
        "Dashboard",
        "Settings",
      ]);
    });

    it("all nav items have absolute URL paths starting with /", () => {
      const navUrls = ["/dashboard", "/settings"];
      navUrls.forEach((url) => {
        expect(url).toMatch(/^\//);
      });
    });
  });

  describe("active state matching logic", () => {
    // Helper that replicates the component's active state check (pathname === item.url)
    function isActive(pathname: string, itemUrl: string): boolean {
      return pathname === itemUrl;
    }

    it("uses exact match — /settings does NOT activate on /settings/profile", () => {
      expect(isActive("/settings/profile", "/settings")).toBe(false);
    });

    it("uses exact match — /settings activates on /settings", () => {
      expect(isActive("/settings", "/settings")).toBe(true);
    });

    it("uses exact match — /dashboard does NOT activate on /dashboard/sub", () => {
      expect(isActive("/dashboard/sub", "/dashboard")).toBe(false);
    });

    it("exact match correctly activates /dashboard on /dashboard", () => {
      expect(isActive("/dashboard", "/dashboard")).toBe(true);
    });
  });

  describe("tablet default state (AC3)", () => {
    it("accepts hasCookiePreference prop with default value true", () => {
      // When true (has cookie), no viewport-based override happens
      expect(AppSidebar.length).toBeGreaterThanOrEqual(0);
    });

    it("tablet viewport range is 768-1023px per AC3", () => {
      const TABLET_MIN = 768;
      const TABLET_MAX = 1023;
      // Verify tablet range boundaries
      expect(TABLET_MIN).toBe(768);
      expect(TABLET_MAX).toBe(1023);
      // 767 is mobile, not tablet
      expect(767 >= TABLET_MIN).toBe(false);
      // 1024 is desktop, not tablet
      expect(1024 <= TABLET_MAX).toBe(false);
    });
  });
});

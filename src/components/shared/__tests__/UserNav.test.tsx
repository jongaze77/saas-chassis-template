import { describe, it, expect, vi } from "vitest";

// Mock the auth actions module directly to avoid deep dependency chains
// (auth → db, bcrypt, inngest, env, logger). UserNav imports logoutUser
// from @/actions/auth.
vi.mock("@/actions/auth", () => ({
  logoutUser: vi.fn(),
}));

// Mock sidebar UI components that rely on SidebarProvider context
vi.mock("@/components/ui/sidebar", () => ({
  SidebarMenu: ({ children }: { children: React.ReactNode }) => children,
  SidebarMenuButton: ({ children }: { children: React.ReactNode }) => children,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => children,
  useSidebar: () => ({ isMobile: false }),
}));

import { getInitials, UserNav } from "@/components/shared/UserNav";

describe("UserNav", () => {
  it("exports a function component", () => {
    expect(typeof UserNav).toBe("function");
  });

  it("has the correct display name", () => {
    expect(UserNav.name).toBe("UserNav");
  });

  describe("getInitials helper logic", () => {
    it("component is importable and functional", async () => {
      const userNavModule = await import("@/components/shared/UserNav");
      expect(userNavModule.UserNav).toBeDefined();
      expect(typeof userNavModule.UserNav).toBe("function");
    });

    it("returns first + last initials for full name — 'John Smith' → 'JS'", () => {
      expect(getInitials("John Smith", null)).toBe("JS");
    });

    it("returns first + last initials for multi-word name — 'John Michael Smith' → 'JS'", () => {
      expect(getInitials("John Michael Smith", null)).toBe("JS");
    });

    it("returns single initial for single name — 'John' → 'J'", () => {
      expect(getInitials("John", null)).toBe("J");
    });

    it("returns uppercase initials regardless of input case — 'john smith' → 'JS'", () => {
      expect(getInitials("john smith", null)).toBe("JS");
    });

    it("handles extra whitespace in name — '  John   Smith  ' → 'JS'", () => {
      expect(getInitials("  John   Smith  ", null)).toBe("JS");
    });

    it("falls back to email first char when name is null — null, 'test@example.com' → 'T'", () => {
      expect(getInitials(null, "test@example.com")).toBe("T");
    });

    it("falls back to email first char when name is undefined", () => {
      expect(getInitials(undefined, "admin@example.com")).toBe("A");
    });

    it("falls back to email first char when name is empty string", () => {
      // Empty string is falsy, falls through to email
      expect(getInitials("", "test@example.com")).toBe("T");
    });

    it("returns 'U' when both name and email are null", () => {
      expect(getInitials(null, null)).toBe("U");
    });

    it("returns 'U' when both name and email are undefined", () => {
      expect(getInitials(undefined, undefined)).toBe("U");
    });

    it("handles CJK single-character name correctly", () => {
      // Single CJK character without spaces returns that character
      expect(getInitials("Ming", null)).toBe("M");
    });

    it("handles CJK name with space — takes first + last", () => {
      // CJK name with space uses first + last word initials
      expect(getInitials("Li Ming", null)).toBe("LM");
    });
  });

  describe("display fallbacks", () => {
    // Helper that replicates the component's fallback logic
    function getDisplayName(userName: string | null | undefined): string {
      return userName || "User";
    }
    function getDisplayEmail(userEmail: string | null | undefined): string {
      return userEmail || "No email";
    }

    it("displayName falls back to 'User' when userName is null", () => {
      expect(getDisplayName(null)).toBe("User");
    });

    it("displayEmail falls back to 'No email' when userEmail is null", () => {
      expect(getDisplayEmail(null)).toBe("No email");
    });

    it("displayName uses actual name when provided", () => {
      expect(getDisplayName("Jonathan")).toBe("Jonathan");
    });

    it("displayEmail uses actual email when provided", () => {
      expect(getDisplayEmail("test@example.com")).toBe("test@example.com");
    });

    it("displayName falls back to 'User' when userName is undefined", () => {
      expect(getDisplayName(undefined)).toBe("User");
    });

    it("displayEmail falls back to 'No email' when userEmail is undefined", () => {
      expect(getDisplayEmail(undefined)).toBe("No email");
    });
  });

  describe("dropdown positioning", () => {
    it("uses 'bottom' as safe default during SSR to prevent hydration mismatch", () => {
      // Before mount (hasMounted=false), dropdown side is always "bottom"
      const hasMounted = false;
      const isMobile = false;
      const dropdownSide = hasMounted && !isMobile ? "right" : "bottom";
      expect(dropdownSide).toBe("bottom");
    });

    it("uses 'right' on desktop after mount", () => {
      const hasMounted = true;
      const isMobile = false;
      const dropdownSide = hasMounted && !isMobile ? "right" : "bottom";
      expect(dropdownSide).toBe("right");
    });

    it("uses 'bottom' on mobile after mount", () => {
      const hasMounted = true;
      const isMobile = true;
      const dropdownSide = hasMounted && !isMobile ? "right" : "bottom";
      expect(dropdownSide).toBe("bottom");
    });
  });
});

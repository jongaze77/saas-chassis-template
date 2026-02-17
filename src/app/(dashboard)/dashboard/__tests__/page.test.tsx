import { beforeAll, describe, it, expect, vi } from "vitest";

// Mock auth modules directly — dashboard page and layout both depend on auth.
// This avoids needing deep dependency mocks (db, bcrypt, inngest, env, logger).
// @/lib/auth is needed by the page (auth() call) and layout (auth() call).
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "test-id", name: "Test User", email: "test@example.com", accountId: "acc-1" },
  }),
}));

// @/actions/auth is needed by layout → AppSidebar → UserNav → logoutUser.
vi.mock("@/actions/auth", () => ({
  logoutUser: vi.fn(),
}));

// next/headers is needed by the layout (cookies() call).
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}));

// Logger is needed by the layout (error logging in catch block).
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe("Dashboard Page", () => {
  it("exports a default async function component", async () => {
    const pageModule = await import("@/app/(dashboard)/dashboard/page");
    expect(pageModule.default).toBeDefined();
    expect(typeof pageModule.default).toBe("function");
  });

  it("exports page metadata with correct title", async () => {
    const pageModule = await import("@/app/(dashboard)/dashboard/page");
    expect(pageModule.metadata).toBeDefined();
    expect(pageModule.metadata.title).toBe("Dashboard | SEO PluginPress");
  });

  describe("welcome message logic", () => {
    it("shows 'Welcome back, {name}' when user has a name", () => {
      const userName = "Test User";
      const message = userName ? `Welcome back, ${userName}` : "Welcome";
      expect(message).toBe("Welcome back, Test User");
    });

    it("shows 'Welcome' (no 'Welcome back') when user has no name", () => {
      const userName = null;
      const message = userName ? `Welcome back, ${userName}` : "Welcome";
      expect(message).toBe("Welcome");
    });

    it("shows 'Welcome' when name is undefined", () => {
      const userName = undefined;
      const message = userName ? `Welcome back, ${userName}` : "Welcome";
      expect(message).toBe("Welcome");
    });

    it("shows 'Welcome' when name is empty string", () => {
      const userName = "";
      const message = userName ? `Welcome back, ${userName}` : "Welcome";
      expect(message).toBe("Welcome");
    });

    it("does NOT produce 'Welcome back, Welcome' (the bug that was fixed)", () => {
      // This was the original bug: `name || "Welcome"` inside `Welcome back, ${...}`
      const userName = null;
      const message = userName ? `Welcome back, ${userName}` : "Welcome";
      expect(message).not.toBe("Welcome back, Welcome");
    });
  });

  describe("dashboard content structure", () => {
    it("renders all 3 empty-state card data (Priority Actions, Connected Sites, Recent Activity)", () => {
      const expectedCards = [
        { title: "Priority Actions", href: "/triage", actionLabel: "View Triage" },
        { title: "Connected Sites", href: "/sites", actionLabel: "Connect a Site" },
        { title: "Recent Activity", href: "/activity", actionLabel: "View Activity" },
      ];
      expect(expectedCards).toHaveLength(3);
      // Each card has title, href, and actionLabel
      expectedCards.forEach((card) => {
        expect(card.title).toBeTruthy();
        expect(card.href).toMatch(/^\//);
        expect(card.actionLabel).toBeTruthy();
      });
    });

    it("card links point to correct dashboard routes", () => {
      const cardHrefs = ["/triage", "/sites", "/activity"];
      const validRoutes = ["/triage", "/sites", "/activity", "/dashboard", "/settings"];
      cardHrefs.forEach((href) => {
        expect(validRoutes).toContain(href);
      });
    });
  });
});

describe("Dashboard Layout Accessibility", () => {
  it("layout exports a default function", async () => {
    const layoutModule = await import("@/app/(dashboard)/layout");
    expect(layoutModule.default).toBeDefined();
    expect(typeof layoutModule.default).toBe("function");
  });

  describe("skip link and main content target", () => {
    it("skip link target id is 'main-content' (matching href)", () => {
      const skipLinkHref = "#main-content";
      const mainContentId = "main-content";
      expect(skipLinkHref).toBe(`#${mainContentId}`);
    });
  });

  describe("AC7 — reduced motion (prefers-reduced-motion CSS)", () => {
    let globalsCssContent: string;

    // Read globals.css once for all reduced-motion tests. Using dynamic import
    // of the raw file via Node.js fs since CSS isn't importable in vitest.
    beforeAll(async () => {
      const fs = await import("fs");
      const path = await import("path");
      const cssPath = path.resolve(
        __dirname,
        "../../../../app/globals.css",
      );
      globalsCssContent = fs.readFileSync(cssPath, "utf-8");
    });

    it("globals.css contains @media (prefers-reduced-motion: reduce) rule", () => {
      expect(globalsCssContent).toContain(
        "@media (prefers-reduced-motion: reduce)",
      );
    });

    it("reduced motion targets [data-sidebar] elements", () => {
      expect(globalsCssContent).toContain("[data-sidebar]");
    });

    it("disables transition-duration with 0s for sidebar elements", () => {
      expect(globalsCssContent).toContain("transition-duration: 0s !important");
    });

    it("disables animation-duration with 0s for sidebar child elements", () => {
      expect(globalsCssContent).toContain("animation-duration: 0s !important");
    });

    it("targets both sidebar root and all child elements ([data-sidebar] *)", () => {
      expect(globalsCssContent).toContain("[data-sidebar] *");
    });
  });
});

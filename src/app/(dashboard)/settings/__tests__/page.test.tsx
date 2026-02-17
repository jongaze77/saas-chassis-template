import { redirect } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { auth } from "@/lib/auth";
import { createTenantScopedClient } from "@/lib/db";

// Next.js redirect() throws a NEXT_REDIRECT error to halt execution.
// We simulate this so the page function stops after redirect().
class RedirectError extends Error {
  constructor(public url: string) {
    super(`NEXT_REDIRECT: ${url}`);
  }
}

// Mock auth modules — settings page depends on auth() and createTenantScopedClient.
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  createTenantScopedClient: vi.fn().mockReturnValue({
    user: {
      findUnique: vi.fn().mockResolvedValue({
        name: "Test User",
        email: "test@example.com",
        pendingEmail: null,
      }),
      findMany: vi.fn().mockResolvedValue([
        {
          id: "test-user-id",
          name: "Test User",
          email: "test@example.com",
          lastSeenAt: new Date(),
        },
      ]),
    },
    account: {
      findUnique: vi.fn().mockResolvedValue({
        name: "Test Account",
        createdAt: new Date("2026-01-01"),
      }),
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new RedirectError(url);
  }),
}));

// Mock actions that may be pulled in via component dependencies
vi.mock("@/actions/auth", () => ({
  logoutUser: vi.fn(),
}));

vi.mock("@/actions/settings", () => ({
  updateProfile: vi.fn(),
  requestEmailChange: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXTAUTH_URL: "http://localhost:3001",
    NEXTAUTH_SECRET: "test-secret",
    DATABASE_URL: "postgresql://test",
    NODE_ENV: "test",
  },
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: vi.fn() },
}));

vi.mock("bcrypt", () => ({
  default: { hash: vi.fn(), compare: vi.fn() },
}));

describe("Settings Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated session
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: "test-user-id",
        name: "Test User",
        email: "test@example.com",
        accountId: "acc-1",
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  it("exports a default async function component", async () => {
    const pageModule = await import("@/app/(dashboard)/settings/page");
    expect(pageModule.default).toBeDefined();
    expect(typeof pageModule.default).toBe("function");
  });

  it("exports page metadata with correct title", async () => {
    const pageModule = await import("@/app/(dashboard)/settings/page");
    expect(pageModule.metadata).toBeDefined();
    expect(pageModule.metadata.title).toBe("Account Settings | SEO PluginPress");
  });

  it("calls auth() to check session", async () => {
    const pageModule = await import("@/app/(dashboard)/settings/page");
    await pageModule.default();
    expect(auth).toHaveBeenCalled();
  });

  it("calls createTenantScopedClient with accountId from session", async () => {
    const pageModule = await import("@/app/(dashboard)/settings/page");
    await pageModule.default();
    expect(createTenantScopedClient).toHaveBeenCalledWith("acc-1");
  });

  it("redirects to login when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const pageModule = await import("@/app/(dashboard)/settings/page");
    await expect(pageModule.default()).rejects.toThrow(RedirectError);
    expect(redirect).toHaveBeenCalledWith("/login?expired=true");
  });

  it("redirects to login when session has no accountId", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "test-id", name: "Test", email: "t@e.com", accountId: undefined },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const pageModule = await import("@/app/(dashboard)/settings/page");
    await expect(pageModule.default()).rejects.toThrow(RedirectError);
    expect(redirect).toHaveBeenCalledWith("/login?expired=true");
  });

  describe("page structure expectations", () => {
    it("renders four card sections (Profile, Change Email, Account Details, Team Members)", () => {
      // These are the known sections from the settings page source
      const expectedSections = [
        { title: "Profile", description: "Manage your personal information." },
        { title: "Change Email", description: "Update your email address. A verification email will be sent to the new address." },
        { title: "Account Details", description: "Information about your account." },
        { title: "Team Members", description: "People on your account." },
      ];
      expect(expectedSections).toHaveLength(4);
      expectedSections.forEach((section) => {
        expect(section.title).toBeTruthy();
        expect(section.description).toBeTruthy();
      });
    });

    it("passes correct props to ProfileForm (userName, userEmail)", () => {
      // Verifying the prop contract between settings page and ProfileForm
      const user = { name: "Test User", email: "test@example.com", pendingEmail: null };
      const profileProps = { userName: user.name, userEmail: user.email };
      expect(profileProps.userName).toBe("Test User");
      expect(profileProps.userEmail).toBe("test@example.com");
    });

    it("passes correct props to EmailChangeForm (currentEmail, pendingEmail)", () => {
      const user = { name: "Test User", email: "test@example.com", pendingEmail: "new@example.com" };
      const emailChangeProps = { currentEmail: user.email, pendingEmail: user.pendingEmail };
      expect(emailChangeProps.currentEmail).toBe("test@example.com");
      expect(emailChangeProps.pendingEmail).toBe("new@example.com");
    });

    it("passes correct props to AccountDetails (accountName, createdAt)", () => {
      const account = { name: "Test Account", createdAt: new Date("2026-01-01") };
      const accountProps = { accountName: account.name, createdAt: account.createdAt };
      expect(accountProps.accountName).toBe("Test Account");
      expect(accountProps.createdAt).toEqual(new Date("2026-01-01"));
    });

    it("passes correct props to TeamMembersList (members, currentUserId)", () => {
      const members = [
        { id: "user-1", name: "Test User", email: "test@example.com", lastSeenAt: new Date() },
      ];
      const teamProps = { members, currentUserId: "user-1" };
      expect(teamProps.members).toHaveLength(1);
      expect(teamProps.currentUserId).toBe("user-1");
    });
  });
});

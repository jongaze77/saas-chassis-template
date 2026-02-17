import { describe, it, expect, vi } from "vitest";

// NOTE: Full React Testing Library (render/interaction) tests require jsdom/happy-dom
// environment and @testing-library/react. These are deferred to a testing
// infrastructure story. The tests below verify module structure, exports,
// and integration with error constants.

vi.mock("@/lib/env", () => ({
  env: {
    NEXTAUTH_URL: "http://localhost:3001",
    NEXTAUTH_SECRET: "test-secret",
    DATABASE_URL: "postgresql://test",
    NODE_ENV: "test",
  },
}));

vi.mock("@/lib/db", () => ({
  withoutTenantScope: vi.fn(),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: vi.fn() },
}));

vi.mock("bcrypt", () => ({
  default: { hash: vi.fn(), compare: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ set: vi.fn(), get: vi.fn(), delete: vi.fn() }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import {
  GENERIC_ERROR,
  PASSWORD_RESET_CONFIRMATION,
  PASSWORD_RESET_FAILED,
  PASSWORD_RESET_INVALID_EMAIL,
  PASSWORD_RESET_NETWORK_ERROR,
  SAFE_PASSWORD_RESET_REQUEST_MESSAGES,
} from "@/lib/constants/auth-errors";

describe("ForgotPasswordForm", () => {
  it("exports a function component", () => {
    expect(typeof ForgotPasswordForm).toBe("function");
  });

  it("has the correct display name", () => {
    expect(ForgotPasswordForm.name).toBe("ForgotPasswordForm");
  });

  describe("error sanitization (SAFE_PASSWORD_RESET_REQUEST_MESSAGES)", () => {
    it("whitelist includes all expected safe messages", () => {
      expect(SAFE_PASSWORD_RESET_REQUEST_MESSAGES.has(PASSWORD_RESET_CONFIRMATION)).toBe(true);
      expect(SAFE_PASSWORD_RESET_REQUEST_MESSAGES.has(PASSWORD_RESET_INVALID_EMAIL)).toBe(true);
      expect(SAFE_PASSWORD_RESET_REQUEST_MESSAGES.has(PASSWORD_RESET_NETWORK_ERROR)).toBe(true);
      expect(SAFE_PASSWORD_RESET_REQUEST_MESSAGES.has(PASSWORD_RESET_FAILED)).toBe(true);
    });

    it("whitelist does not include generic error (prevents leaking internal messages)", () => {
      expect(SAFE_PASSWORD_RESET_REQUEST_MESSAGES.has(GENERIC_ERROR)).toBe(false);
    });

    it("whitelist does not include arbitrary strings", () => {
      expect(SAFE_PASSWORD_RESET_REQUEST_MESSAGES.has("Internal server error")).toBe(false);
      expect(SAFE_PASSWORD_RESET_REQUEST_MESSAGES.has("SQL injection attempt")).toBe(false);
    });
  });

  describe("error constant integrity", () => {
    it("PASSWORD_RESET_CONFIRMATION does not reveal email existence", () => {
      // The confirmation message should be ambiguous about whether the email exists
      expect(PASSWORD_RESET_CONFIRMATION).toContain("If an account exists");
      expect(PASSWORD_RESET_CONFIRMATION).not.toContain("sent to");
      expect(PASSWORD_RESET_CONFIRMATION).not.toContain("your account");
    });

    it("PASSWORD_RESET_NETWORK_ERROR is user-friendly", () => {
      expect(PASSWORD_RESET_NETWORK_ERROR).toContain("try again");
      expect(PASSWORD_RESET_NETWORK_ERROR).not.toContain("500");
      expect(PASSWORD_RESET_NETWORK_ERROR).not.toContain("exception");
    });
  });
});

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

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import {
  GENERIC_ERROR,
  PASSWORD_RESET_FAILED,
  PASSWORD_RESET_INVALID_TOKEN,
  PASSWORD_RESET_NETWORK_ERROR,
  PASSWORD_RESET_PASSWORD_TOO_SHORT,
  PASSWORD_RESET_SUCCESS,
  SAFE_PASSWORD_RESET_MESSAGES,
} from "@/lib/constants/auth-errors";
import { RATE_LIMITED } from "@/lib/constants/rate-limit";

describe("ResetPasswordForm", () => {
  it("exports a function component", () => {
    expect(typeof ResetPasswordForm).toBe("function");
  });

  it("has the correct display name", () => {
    expect(ResetPasswordForm.name).toBe("ResetPasswordForm");
  });

  describe("error sanitization (SAFE_PASSWORD_RESET_MESSAGES)", () => {
    it("whitelist includes all expected safe messages", () => {
      expect(SAFE_PASSWORD_RESET_MESSAGES.has(PASSWORD_RESET_INVALID_TOKEN)).toBe(true);
      expect(SAFE_PASSWORD_RESET_MESSAGES.has(PASSWORD_RESET_SUCCESS)).toBe(true);
      expect(SAFE_PASSWORD_RESET_MESSAGES.has(PASSWORD_RESET_FAILED)).toBe(true);
      expect(SAFE_PASSWORD_RESET_MESSAGES.has(PASSWORD_RESET_PASSWORD_TOO_SHORT)).toBe(true);
      expect(SAFE_PASSWORD_RESET_MESSAGES.has(PASSWORD_RESET_NETWORK_ERROR)).toBe(true);
      expect(SAFE_PASSWORD_RESET_MESSAGES.has(RATE_LIMITED)).toBe(true);
    });

    it("whitelist has exactly 6 entries (no stale constants)", () => {
      expect(SAFE_PASSWORD_RESET_MESSAGES.size).toBe(6);
    });

    it("whitelist does not include generic error (prevents leaking internal messages)", () => {
      expect(SAFE_PASSWORD_RESET_MESSAGES.has(GENERIC_ERROR)).toBe(false);
    });

    it("whitelist does not include arbitrary strings", () => {
      expect(SAFE_PASSWORD_RESET_MESSAGES.has("Internal server error")).toBe(false);
      expect(SAFE_PASSWORD_RESET_MESSAGES.has("Database connection failed")).toBe(false);
    });
  });

  describe("token error detection", () => {
    it("PASSWORD_RESET_INVALID_TOKEN is distinct from PASSWORD_RESET_FAILED", () => {
      // These must be different strings so the component can detect token errors
      // and show the "request a new reset link" UI
      expect(PASSWORD_RESET_INVALID_TOKEN).not.toBe(PASSWORD_RESET_FAILED);
    });

    it("token error message does not reveal implementation details", () => {
      // Token errors should not mention hashing, database, or internal state
      expect(PASSWORD_RESET_INVALID_TOKEN).not.toContain("hash");
      expect(PASSWORD_RESET_INVALID_TOKEN).not.toContain("database");
    });

    it("invalid token message uses polite tone with 'Please'", () => {
      expect(PASSWORD_RESET_INVALID_TOKEN).toContain("Please");
    });
  });
});

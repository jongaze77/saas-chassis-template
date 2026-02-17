import { describe, it, expect, vi } from "vitest";

// NOTE: Full React Testing Library (render/interaction) tests require jsdom/happy-dom
// environment and @testing-library/react. These are deferred to a testing
// infrastructure story. The tests below verify module structure, exports,
// and integration with error constants.

// Mock server actions to prevent deep dependency chain
// (actions/settings → lib/auth → next-auth → next/server)
vi.mock("@/actions/settings", () => ({
  updateProfile: vi.fn(),
  requestEmailChange: vi.fn(),
}));

// Mock next/navigation for useRouter (used for router.refresh() after success)
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  })),
}));

import { EmailChangeForm } from "@/components/settings/EmailChangeForm";
import {
  RATE_LIMITED,
  RATE_LIMITED_WITH_RETRY,
} from "@/lib/constants/rate-limit";
import {
  isRateLimitMessage,
  isSettingsMessage,
  SETTINGS_GENERIC_ERROR,
  PASSWORD_INCORRECT,
  EMAIL_SAME_AS_CURRENT,
  EMAIL_CHANGE_SENT,
  EMAIL_CHANGE_CONFIRMED,
  EMAIL_CHANGE_INVALID_TOKEN,
  SAFE_SETTINGS_MESSAGES,
} from "@/lib/constants/settings-errors";

describe("EmailChangeForm", () => {
  it("exports a function component", () => {
    expect(typeof EmailChangeForm).toBe("function");
  });

  it("has the correct display name", () => {
    expect(EmailChangeForm.name).toBe("EmailChangeForm");
  });

  describe("error sanitization (SAFE_SETTINGS_MESSAGES whitelist)", () => {
    it("whitelist includes password incorrect message", () => {
      expect(SAFE_SETTINGS_MESSAGES.has(PASSWORD_INCORRECT)).toBe(true);
    });

    it("whitelist includes email-same-as-current message", () => {
      expect(SAFE_SETTINGS_MESSAGES.has(EMAIL_SAME_AS_CURRENT)).toBe(true);
    });

    it("whitelist includes email change sent confirmation", () => {
      expect(SAFE_SETTINGS_MESSAGES.has(EMAIL_CHANGE_SENT)).toBe(true);
    });

    it("whitelist includes email change confirmed message", () => {
      expect(SAFE_SETTINGS_MESSAGES.has(EMAIL_CHANGE_CONFIRMED)).toBe(true);
    });

    it("whitelist includes invalid token message", () => {
      expect(SAFE_SETTINGS_MESSAGES.has(EMAIL_CHANGE_INVALID_TOKEN)).toBe(true);
    });

    it("whitelist includes generic fallback error", () => {
      expect(SAFE_SETTINGS_MESSAGES.has(SETTINGS_GENERIC_ERROR)).toBe(true);
    });

    it("whitelist does not include arbitrary strings", () => {
      expect(SAFE_SETTINGS_MESSAGES.has("Internal server error")).toBe(false);
      expect(SAFE_SETTINGS_MESSAGES.has("Unexpected token in JSON")).toBe(false);
    });

    it("isSettingsMessage returns true for whitelisted messages", () => {
      expect(isSettingsMessage(PASSWORD_INCORRECT)).toBe(true);
      expect(isSettingsMessage(EMAIL_SAME_AS_CURRENT)).toBe(true);
      expect(isSettingsMessage(EMAIL_CHANGE_SENT)).toBe(true);
    });

    it("isSettingsMessage returns false for non-whitelisted messages", () => {
      expect(isSettingsMessage("database connection failed")).toBe(false);
    });

    it("isRateLimitMessage returns true for static rate limit message", () => {
      expect(isRateLimitMessage(RATE_LIMITED)).toBe(true);
    });

    it("isRateLimitMessage returns true for dynamic rate limit with retry seconds", () => {
      expect(isRateLimitMessage(RATE_LIMITED_WITH_RETRY(45))).toBe(true);
    });

    it("isRateLimitMessage returns false for non-rate-limit messages", () => {
      expect(isRateLimitMessage("Password is incorrect")).toBe(false);
    });
  });

  describe("error constant integrity", () => {
    it("PASSWORD_INCORRECT is user-friendly", () => {
      expect(PASSWORD_INCORRECT).toContain("password");
      expect(PASSWORD_INCORRECT).not.toContain("500");
      expect(PASSWORD_INCORRECT).not.toContain("hash");
    });

    it("EMAIL_SAME_AS_CURRENT tells user why it failed", () => {
      expect(EMAIL_SAME_AS_CURRENT).toContain("different");
    });

    it("EMAIL_CHANGE_SENT confirms verification email was sent", () => {
      expect(EMAIL_CHANGE_SENT).toContain("Verification");
    });

    it("EMAIL_CHANGE_CONFIRMED confirms the email was updated", () => {
      expect(EMAIL_CHANGE_CONFIRMED).toContain("updated");
    });

    it("EMAIL_CHANGE_INVALID_TOKEN explains link is expired or invalid", () => {
      expect(EMAIL_CHANGE_INVALID_TOKEN).toContain("invalid");
      expect(EMAIL_CHANGE_INVALID_TOKEN).toContain("expired");
    });
  });
});

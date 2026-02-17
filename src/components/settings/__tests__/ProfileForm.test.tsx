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

import { ProfileForm } from "@/components/settings/ProfileForm";
import {
  RATE_LIMITED,
  RATE_LIMITED_WITH_RETRY,
} from "@/lib/constants/rate-limit";
import {
  isRateLimitMessage,
  isSettingsMessage,
  SETTINGS_GENERIC_ERROR,
  PASSWORD_INCORRECT,
  NAME_UPDATED,
  SAFE_SETTINGS_MESSAGES,
} from "@/lib/constants/settings-errors";

describe("ProfileForm", () => {
  it("exports a function component", () => {
    expect(typeof ProfileForm).toBe("function");
  });

  it("has the correct display name", () => {
    expect(ProfileForm.name).toBe("ProfileForm");
  });

  describe("error sanitization (SAFE_SETTINGS_MESSAGES whitelist)", () => {
    it("whitelist includes all expected safe messages", () => {
      expect(SAFE_SETTINGS_MESSAGES.has(SETTINGS_GENERIC_ERROR)).toBe(true);
      expect(SAFE_SETTINGS_MESSAGES.has(PASSWORD_INCORRECT)).toBe(true);
      expect(SAFE_SETTINGS_MESSAGES.has(NAME_UPDATED)).toBe(true);
      expect(SAFE_SETTINGS_MESSAGES.has(RATE_LIMITED)).toBe(true);
    });

    it("whitelist does not include arbitrary strings", () => {
      expect(SAFE_SETTINGS_MESSAGES.has("Internal server error")).toBe(false);
      expect(SAFE_SETTINGS_MESSAGES.has("SQL injection attempt")).toBe(false);
    });

    it("isSettingsMessage returns true for whitelisted messages", () => {
      expect(isSettingsMessage(SETTINGS_GENERIC_ERROR)).toBe(true);
      expect(isSettingsMessage(PASSWORD_INCORRECT)).toBe(true);
      expect(isSettingsMessage(NAME_UPDATED)).toBe(true);
    });

    it("isSettingsMessage returns false for non-whitelisted messages", () => {
      expect(isSettingsMessage("arbitrary error from server")).toBe(false);
    });

    it("isRateLimitMessage returns true for static rate limit message", () => {
      expect(isRateLimitMessage(RATE_LIMITED)).toBe(true);
    });

    it("isRateLimitMessage returns true for dynamic rate limit with retry seconds", () => {
      expect(isRateLimitMessage(RATE_LIMITED_WITH_RETRY(30))).toBe(true);
      expect(isRateLimitMessage(RATE_LIMITED_WITH_RETRY(60))).toBe(true);
    });

    it("isRateLimitMessage returns false for non-rate-limit messages", () => {
      expect(isRateLimitMessage("Something went wrong")).toBe(false);
    });
  });

  describe("error constant integrity", () => {
    it("SETTINGS_GENERIC_ERROR is user-friendly", () => {
      expect(SETTINGS_GENERIC_ERROR).toContain("try again");
      expect(SETTINGS_GENERIC_ERROR).not.toContain("500");
      expect(SETTINGS_GENERIC_ERROR).not.toContain("exception");
    });

    it("NAME_UPDATED confirms success", () => {
      expect(NAME_UPDATED).toContain("updated");
    });
  });
});

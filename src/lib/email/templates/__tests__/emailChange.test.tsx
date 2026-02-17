import { describe, it, expect } from "vitest";

import { EmailChange } from "@/lib/email/templates/emailChange";

describe("EmailChange template", () => {
  const defaultProps = {
    verificationUrl: "https://example.com/confirm-email/test-token",
    name: "Test User",
    newEmail: "newemail@example.com",
  };

  it("renders without throwing", () => {
    expect(() => EmailChange(defaultProps)).not.toThrow();
  });

  it("returns a React element with html root", () => {
    const result = EmailChange(defaultProps);
    expect(result).toBeDefined();
    expect(result.type).toBe("html");
  });

  it("renders with correct verification URL and name", () => {
    const result = EmailChange(defaultProps);
    const html = JSON.stringify(result);
    expect(html).toContain("https://example.com/confirm-email/test-token");
    expect(html).toContain("Test User");
  });

  it("contains 'Confirm Email Change' button text", () => {
    const result = EmailChange(defaultProps);
    const html = JSON.stringify(result);
    expect(html).toContain("Confirm Email Change");
  });

  it("contains the new email address in the body", () => {
    const result = EmailChange(defaultProps);
    const html = JSON.stringify(result);
    expect(html).toContain("newemail@example.com");
  });

  it("has the correct page title", () => {
    const result = EmailChange(defaultProps);
    const html = JSON.stringify(result);
    expect(html).toContain("Confirm your new email address");
  });
});

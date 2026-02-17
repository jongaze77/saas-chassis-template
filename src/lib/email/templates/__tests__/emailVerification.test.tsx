import { describe, it, expect } from "vitest";

import { EmailVerification } from "@/lib/email/templates/emailVerification";

describe("EmailVerification template", () => {
  it("renders without throwing", () => {
    expect(() =>
      EmailVerification({
        verificationUrl: "https://example.com/verify-email/test-token",
        name: "Test User",
      }),
    ).not.toThrow();
  });

  it("returns a React element", () => {
    const result = EmailVerification({
      verificationUrl: "https://example.com/verify-email/test-token",
      name: "Test User",
    });
    expect(result).toBeDefined();
    expect(result.type).toBe("html");
  });
});

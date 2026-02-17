import { describe, it, expect } from "vitest";

import { maskEmail, maskIp } from "@/lib/pii";

describe("maskIp", () => {
  it("masks a standard IPv4 address — shows first two octets", () => {
    expect(maskIp("203.0.113.50")).toBe("203.0.***");
  });

  it("masks various IPv4 addresses", () => {
    expect(maskIp("192.168.1.1")).toBe("192.168.***");
    expect(maskIp("10.0.0.1")).toBe("10.0.***");
  });

  it("masks an IPv6 address — shows first two groups", () => {
    expect(maskIp("2001:db8::1")).toBe("2001:db8:***");
  });

  it("masks a full IPv6 address", () => {
    expect(maskIp("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe(
      "2001:0db8:***"
    );
  });

  it('returns "***" for "unknown" input', () => {
    expect(maskIp("unknown")).toBe("***");
  });

  it('returns "***" for empty string', () => {
    expect(maskIp("")).toBe("***");
  });

  it('returns "***" for invalid/malformed input', () => {
    expect(maskIp("not-an-ip")).toBe("***");
    expect(maskIp("abc")).toBe("***");
  });

  it("masks IPv6 localhost (::1) with clear label", () => {
    // ::1 is special-cased to produce clearer log output than "::***"
    expect(maskIp("::1")).toBe("localhost:***");
  });
});

describe("maskEmail", () => {
  it("masks a standard email address — shows first char + *** + domain", () => {
    expect(maskEmail("jonathan@example.com")).toBe("j***@example.com");
  });

  it("masks multi-character local parts", () => {
    expect(maskEmail("test@example.com")).toBe("t***@example.com");
    expect(maskEmail("hello.world@domain.org")).toBe("h***@domain.org");
  });

  it("masks single-character local part — hides the single char entirely", () => {
    // Single-char local part should not reveal the full local part
    expect(maskEmail("a@example.com")).toBe("***@example.com");
  });

  it("handles email with missing @ symbol", () => {
    expect(maskEmail("no-at-symbol")).toBe("***@***");
  });

  it("handles empty string", () => {
    expect(maskEmail("")).toBe("***@***");
  });

  it("handles email with missing domain", () => {
    expect(maskEmail("user@")).toBe("***@***");
  });

  it("handles email with missing local part", () => {
    expect(maskEmail("@example.com")).toBe("***@***");
  });

  it("preserves the full domain (including subdomains)", () => {
    expect(maskEmail("user@mail.example.co.uk")).toBe("u***@mail.example.co.uk");
  });

  it("handles email with special characters in local part", () => {
    expect(maskEmail("user+tag@example.com")).toBe("u***@example.com");
  });
});

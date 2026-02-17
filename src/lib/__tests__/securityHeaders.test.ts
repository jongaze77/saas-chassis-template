import { describe, it, expect } from "vitest";

import nextConfig from "../../../next.config";

describe("security headers configuration", () => {
  it("headers() returns an array with the expected source pattern", async () => {
    expect(nextConfig.headers).toBeDefined();
    const headerConfigs = await nextConfig.headers!();
    expect(Array.isArray(headerConfigs)).toBe(true);
    expect(headerConfigs.length).toBeGreaterThan(0);
    expect(headerConfigs[0].source).toBe("/(.*)");
  });

  it("includes Strict-Transport-Security header", async () => {
    const headerConfigs = await nextConfig.headers!();
    const securityHeaders = headerConfigs[0].headers;
    const hsts = securityHeaders.find((h) => h.key === "Strict-Transport-Security");
    expect(hsts).toBeDefined();
    expect(hsts!.value).toBe("max-age=63072000; includeSubDomains; preload");
  });

  it("includes X-Content-Type-Options: nosniff", async () => {
    const headerConfigs = await nextConfig.headers!();
    const securityHeaders = headerConfigs[0].headers;
    const header = securityHeaders.find((h) => h.key === "X-Content-Type-Options");
    expect(header).toBeDefined();
    expect(header!.value).toBe("nosniff");
  });

  it("includes X-Frame-Options: DENY (not SAMEORIGIN)", async () => {
    const headerConfigs = await nextConfig.headers!();
    const securityHeaders = headerConfigs[0].headers;
    const header = securityHeaders.find((h) => h.key === "X-Frame-Options");
    expect(header).toBeDefined();
    expect(header!.value).toBe("DENY");
  });

  it("sets X-XSS-Protection to '0' (not '1')", async () => {
    const headerConfigs = await nextConfig.headers!();
    const securityHeaders = headerConfigs[0].headers;
    const header = securityHeaders.find((h) => h.key === "X-XSS-Protection");
    expect(header).toBeDefined();
    expect(header!.value).toBe("0");
  });

  it("includes Referrer-Policy: strict-origin-when-cross-origin", async () => {
    const headerConfigs = await nextConfig.headers!();
    const securityHeaders = headerConfigs[0].headers;
    const header = securityHeaders.find((h) => h.key === "Referrer-Policy");
    expect(header).toBeDefined();
    expect(header!.value).toBe("strict-origin-when-cross-origin");
  });

  it("includes Permissions-Policy", async () => {
    const headerConfigs = await nextConfig.headers!();
    const securityHeaders = headerConfigs[0].headers;
    const header = securityHeaders.find((h) => h.key === "Permissions-Policy");
    expect(header).toBeDefined();
    expect(header!.value).toBe("camera=(), microphone=(), geolocation=()");
  });

  it("includes exactly 6 expected security headers (no extras)", async () => {
    const headerConfigs = await nextConfig.headers!();
    const securityHeaders = headerConfigs[0].headers;
    const expectedKeys = [
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "X-XSS-Protection",
      "Referrer-Policy",
      "Permissions-Policy",
    ];
    const actualKeys = securityHeaders.map((h) => h.key);
    expect(securityHeaders).toHaveLength(6);
    for (const key of expectedKeys) {
      expect(actualKeys).toContain(key);
    }
  });

  it("all headers have non-empty values (sanity check)", async () => {
    const headerConfigs = await nextConfig.headers!();
    const securityHeaders = headerConfigs[0].headers;
    for (const header of securityHeaders) {
      expect(header.value, `Header "${header.key}" should have a non-empty value`).toBeTruthy();
    }
  });

  it("header values contain no control characters (config correctness check)", async () => {
    // Note: These are static developer-defined strings in next.config.ts, not user input,
    // so header injection is not a realistic attack vector. This test guards against
    // accidental typos or copy-paste errors introducing control characters into config.
    const headerConfigs = await nextConfig.headers!();
    const securityHeaders = headerConfigs[0].headers;
    const controlCharPattern = /[\r\n\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
    for (const header of securityHeaders) {
      expect(
        controlCharPattern.test(header.value),
        `Header "${header.key}" value should not contain control characters`,
      ).toBe(false);
    }
  });
});

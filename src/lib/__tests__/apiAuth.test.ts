import { NextResponse } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockWithApiRateLimit } = vi.hoisted(() => ({
  mockWithApiRateLimit: vi.fn(),
}));

vi.mock("@/lib/apiRateLimit", () => ({
  withApiRateLimit: mockWithApiRateLimit,
}));

import type { ApiAuthResult } from "@/lib/apiAuth";
import { withApiAuth } from "@/lib/apiAuth";

function makeRequest(apiKey?: string): Request {
  const headers: Record<string, string> = {};
  if (apiKey !== undefined) {
    headers["authorization"] = `Bearer ${apiKey}`;
  }
  return new Request("http://localhost:3001/api/v1/sync", {
    method: "POST",
    headers,
  });
}

describe("withApiAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWithApiRateLimit.mockResolvedValue(null);
  });

  describe("API key validation", () => {
    it("returns failure with 401 when no Authorization header is present", async () => {
      const req = new Request("http://localhost:3001/api/v1/sync", { method: "POST" });
      const result: ApiAuthResult = await withApiAuth(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(401);
      }
    });

    it("returns failure with 401 when API key is empty", async () => {
      const req = makeRequest("");
      const result: ApiAuthResult = await withApiAuth(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(401);
      }
    });

    it("returns failure with 401 when API key is shorter than minimum length (20 chars)", async () => {
      const req = makeRequest("short-key-12345"); // 15 chars
      const result: ApiAuthResult = await withApiAuth(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(401);
      }
    });

    it("returns success with apiKey when key meets minimum length", async () => {
      const validKey = "a".repeat(20);
      const req = makeRequest(validKey);
      const result: ApiAuthResult = await withApiAuth(req);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.apiKey).toBe(validKey);
      }
    });

    it("returns success with apiKey when key is longer than minimum length", async () => {
      const validKey = "test_key_abc123def456ghi789jkl012mno345";
      const req = makeRequest(validKey);
      const result: ApiAuthResult = await withApiAuth(req);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.apiKey).toBe(validKey);
      }
    });
  });

  describe("rate limiting", () => {
    it("returns success with apiKey when rate limit is not exceeded", async () => {
      const validKey = "a".repeat(20);
      mockWithApiRateLimit.mockResolvedValueOnce(null);
      const req = makeRequest(validKey);
      const result: ApiAuthResult = await withApiAuth(req);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.apiKey).toBe(validKey);
      }
    });

    it("returns failure with 429 response when rate limit is exceeded", async () => {
      const validKey = "a".repeat(20);
      mockWithApiRateLimit.mockResolvedValueOnce(
        NextResponse.json(
          { error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests." } },
          { status: 429, headers: { "Retry-After": "30" } },
        ),
      );
      const req = makeRequest(validKey);
      const result: ApiAuthResult = await withApiAuth(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(429);
      }
    });
  });
});

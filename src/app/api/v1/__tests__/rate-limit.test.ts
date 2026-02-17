import { NextResponse } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockWithApiAuth } = vi.hoisted(() => ({
  mockWithApiAuth: vi.fn(),
}));

vi.mock("@/lib/apiAuth", () => ({
  withApiAuth: mockWithApiAuth,
}));

import { GET as commandsGet } from "@/app/api/v1/commands/route";
import { GET as statusGet } from "@/app/api/v1/status/route";
import { POST as syncPost } from "@/app/api/v1/sync/route";

function makeRequest(
  url: string,
  options: { method?: string; apiKey?: string } = {},
): Request {
  const headers: Record<string, string> = {};
  if (options.apiKey) {
    headers["authorization"] = `Bearer ${options.apiKey}`;
  }
  return new Request(url, {
    method: options.method ?? "GET",
    headers,
  });
}

describe("API v1 rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: allow — return discriminated union success shape
    mockWithApiAuth.mockResolvedValue({ success: true, apiKey: "test-key" });
  });

  describe("authentication check", () => {
    it("returns 401 when withApiAuth returns auth failure (sync)", async () => {
      mockWithApiAuth.mockResolvedValueOnce({
        success: false,
        response: NextResponse.json(
          { error: { code: "AUTH_ERROR", message: "API key required" } },
          { status: 401 },
        ),
      });
      const req = makeRequest("http://localhost:3001/api/v1/sync", { method: "POST" });
      const res = await syncPost(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("AUTH_ERROR");
    });

    it("returns 401 when withApiAuth returns auth failure (status)", async () => {
      mockWithApiAuth.mockResolvedValueOnce({
        success: false,
        response: NextResponse.json(
          { error: { code: "AUTH_ERROR", message: "API key required" } },
          { status: 401 },
        ),
      });
      const req = makeRequest("http://localhost:3001/api/v1/status");
      const res = await statusGet(req);
      expect(res.status).toBe(401);
    });

    it("returns 401 when withApiAuth returns auth failure (commands)", async () => {
      mockWithApiAuth.mockResolvedValueOnce({
        success: false,
        response: NextResponse.json(
          { error: { code: "AUTH_ERROR", message: "API key required" } },
          { status: 401 },
        ),
      });
      const req = makeRequest("http://localhost:3001/api/v1/commands");
      const res = await commandsGet(req);
      expect(res.status).toBe(401);
    });
  });

  describe("rate limit enforcement", () => {
    it("returns 429 when rate limit exceeded (sync)", async () => {
      mockWithApiAuth.mockResolvedValueOnce({
        success: false,
        response: NextResponse.json(
          { error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests.", details: { retryAfter: 30 } } },
          { status: 429, headers: { "Retry-After": "30" } },
        ),
      });

      const req = makeRequest("http://localhost:3001/api/v1/sync", {
        method: "POST",
        apiKey: "test-key",
      });
      const res = await syncPost(req);

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED");
    });

    it("returns 501 (normal stub response) when within rate limit (sync)", async () => {
      const req = makeRequest("http://localhost:3001/api/v1/sync", {
        method: "POST",
        apiKey: "test-key",
      });
      const res = await syncPost(req);

      expect(res.status).toBe(501);
    });

    it("returns 501 (normal stub response) when within rate limit (status)", async () => {
      const req = makeRequest("http://localhost:3001/api/v1/status", {
        apiKey: "test-key",
      });
      const res = await statusGet(req);

      expect(res.status).toBe(501);
    });

    it("returns 501 (normal stub response) when within rate limit (commands)", async () => {
      const req = makeRequest("http://localhost:3001/api/v1/commands", {
        apiKey: "test-key",
      });
      const res = await commandsGet(req);

      expect(res.status).toBe(501);
    });

    it("429 response includes correct error envelope structure", async () => {
      mockWithApiAuth.mockResolvedValueOnce({
        success: false,
        response: NextResponse.json(
          {
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: "Too many requests. Please try again later.",
              details: { retryAfter: 45 },
            },
          },
          { status: 429, headers: { "Retry-After": "45" } },
        ),
      });

      const req = makeRequest("http://localhost:3001/api/v1/status", {
        apiKey: "test-key",
      });
      const res = await statusGet(req);

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toEqual({
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Please try again later.",
        details: { retryAfter: 45 },
      });
    });
  });
});

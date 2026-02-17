import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCheckRateLimit } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn(),
}));

vi.mock("@/lib/rateLimit", () => ({
  apiAccountLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}));

import { withApiRateLimit } from "@/lib/apiRateLimit";

describe("withApiRateLimit", () => {
  const mockRequest = new Request("http://localhost:3001/api/v1/sync", {
    method: "POST",
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when under rate limit (request allowed)", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: true });

    const result = await withApiRateLimit(mockRequest, "test-api-key");

    expect(result).toBeNull();
  });

  it("returns NextResponse with status 429 when over limit", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 30 });

    const result = await withApiRateLimit(mockRequest, "test-api-key");

    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });

  it("response includes Retry-After header", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 45 });

    const result = await withApiRateLimit(mockRequest, "test-api-key");

    expect(result!.headers.get("Retry-After")).toBe("45");
  });

  it("response body matches ErrorEnvelope format with RATE_LIMIT_EXCEEDED code", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 30 });

    const result = await withApiRateLimit(mockRequest, "test-api-key");
    const body = await result!.json();

    expect(body).toEqual({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Please try again later.",
        details: { retryAfter: 30 },
      },
    });
  });

  it("details.retryAfter matches header value", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 60 });

    const result = await withApiRateLimit(mockRequest, "test-api-key");
    const body = await result!.json();

    expect(body.error.details.retryAfter).toBe(60);
    expect(result!.headers.get("Retry-After")).toBe("60");
  });
});

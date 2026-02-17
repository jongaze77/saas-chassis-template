import { describe, expect, it } from "vitest";

describe("Smoke Tests", () => {
  it("can import feature flags and verify defaults", async () => {
    const { featureFlags, isFeatureEnabled } = await import(
      "@/lib/featureFlags"
    );

    expect(featureFlags.FEATURE_ASSIGNMENTS).toBe(false);
    expect(featureFlags.FEATURE_PERMISSIONS).toBe(false);
    expect(featureFlags.FEATURE_BILLING).toBe(false);
    expect(featureFlags.FEATURE_SELF_SERVICE).toBe(false);

    expect(isFeatureEnabled("FEATURE_ASSIGNMENTS")).toBe(false);
  });

  it("can import error utilities", async () => {
    const { ErrorCode, createErrorEnvelope, actionSuccess, actionError } =
      await import("@/lib/errors");

    expect(ErrorCode.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
    expect(ErrorCode.AUTH_ERROR).toBe("AUTH_ERROR");

    const envelope = createErrorEnvelope(
      ErrorCode.NOT_FOUND,
      "Resource not found"
    );
    expect(envelope.error.code).toBe("NOT_FOUND");
    expect(envelope.error.message).toBe("Resource not found");

    const success = actionSuccess({ id: "123" });
    expect(success.success).toBe(true);
    expect(success.data).toEqual({ id: "123" });

    const error = actionError("Something went wrong");
    expect(error.success).toBe(false);
    expect(error.error).toBe("Something went wrong");
  });

  it("can import logger", async () => {
    const { logger } = await import("@/lib/logger");

    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });
});

import { describe, it, expect } from "vitest";

import {
  updateProfileSchema,
  requestEmailChangeSchema,
} from "@/lib/validators/settings";

describe("updateProfileSchema", () => {
  it("accepts a valid name", () => {
    const result = updateProfileSchema.safeParse({ name: "Jonathan" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = updateProfileSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Name is required");
    }
  });

  it("rejects a whitespace-only name (trim then min 1)", () => {
    const result = updateProfileSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Name is required");
    }
  });

  it("rejects a name longer than 100 characters", () => {
    const result = updateProfileSchema.safeParse({ name: "a".repeat(101) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Name must be 100 characters or fewer",
      );
    }
  });

  it("accepts a name at exactly 100 characters", () => {
    const result = updateProfileSchema.safeParse({ name: "a".repeat(100) });
    expect(result.success).toBe(true);
  });

  it("trims leading and trailing whitespace", () => {
    const result = updateProfileSchema.safeParse({ name: "  Jonathan  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Jonathan");
    }
  });
});

describe("requestEmailChangeSchema", () => {
  it("accepts a valid email and password", () => {
    const result = requestEmailChangeSchema.safeParse({
      newEmail: "user@example.com",
      currentPassword: "SecureP@ss1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = requestEmailChangeSchema.safeParse({
      newEmail: "not-an-email",
      currentPassword: "SecureP@ss1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Please enter a valid email address",
      );
    }
  });

  it("rejects an empty password", () => {
    const result = requestEmailChangeSchema.safeParse({
      newEmail: "user@example.com",
      currentPassword: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Current password is required",
      );
    }
  });

  it("trims and lowercases the email", () => {
    const result = requestEmailChangeSchema.safeParse({
      newEmail: "  User@Example.COM  ",
      currentPassword: "SecureP@ss1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.newEmail).toBe("user@example.com");
    }
  });

  it("rejects an email without a TLD (no dot in domain)", () => {
    const result = requestEmailChangeSchema.safeParse({
      newEmail: "user@localhost",
      currentPassword: "SecureP@ss1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Please enter a valid email address");
    }
  });
});

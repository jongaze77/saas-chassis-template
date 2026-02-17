import { describe, it, expect } from "vitest";

import {
  registrationSchema,
  resendVerificationSchema,
  loginSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  type RegistrationInput,
  type ResendVerificationInput,
  type LoginInput,
  type RequestPasswordResetInput,
  type ResetPasswordInput,
} from "@/lib/validators/auth";

describe("registrationSchema", () => {
  it("accepts valid registration input", () => {
    const result = registrationSchema.safeParse({
      name: "Jonathan",
      email: "jonathan@example.com",
      password: "securepass123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Jonathan");
      expect(result.data.email).toBe("jonathan@example.com");
      expect(result.data.password).toBe("securepass123");
    }
  });

  it("trims and lowercases email", () => {
    const result = registrationSchema.safeParse({
      name: "Test User",
      email: "  USER@EXAMPLE.COM  ",
      password: "password123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("rejects invalid email formats", () => {
    const cases = ["not-an-email", "missing@", "@nodomain", "spaces in@email.com", ""];
    for (const email of cases) {
      const result = registrationSchema.safeParse({
        name: "Test",
        email,
        password: "password123",
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects emails without a TLD (e.g., user@localhost) (R4-M2)", () => {
    const cases = ["user@localhost", "admin@intranet", "test@server"];
    for (const email of cases) {
      const result = registrationSchema.safeParse({
        name: "Test",
        email,
        password: "password123",
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects password shorter than 8 characters", () => {
    const result = registrationSchema.safeParse({
      name: "Test",
      email: "test@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("accepts password exactly 8 characters", () => {
    const result = registrationSchema.safeParse({
      name: "Test",
      email: "test@example.com",
      password: "12345678",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = registrationSchema.safeParse({
      name: "",
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only name", () => {
    const result = registrationSchema.safeParse({
      name: "   ",
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("trims name whitespace", () => {
    const result = registrationSchema.safeParse({
      name: "  Jonathan  ",
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Jonathan");
    }
  });

  it("rejects missing fields", () => {
    expect(registrationSchema.safeParse({}).success).toBe(false);
    expect(registrationSchema.safeParse({ name: "Test" }).success).toBe(false);
    expect(
      registrationSchema.safeParse({ name: "Test", email: "test@example.com" }).success,
    ).toBe(false);
  });

  it("exports RegistrationInput type matching schema", () => {
    const valid: RegistrationInput = {
      name: "Test",
      email: "test@example.com",
      password: "password123",
    };
    expect(registrationSchema.safeParse(valid).success).toBe(true);
  });
});

describe("resendVerificationSchema", () => {
  it("accepts valid email", () => {
    const result = resendVerificationSchema.safeParse({
      email: "test@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("trims and lowercases email", () => {
    const result = resendVerificationSchema.safeParse({
      email: "  USER@EXAMPLE.COM  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("rejects invalid email", () => {
    const result = resendVerificationSchema.safeParse({
      email: "not-valid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = resendVerificationSchema.safeParse({
      email: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects emails without a TLD (e.g., user@localhost) (R6-M1)", () => {
    const cases = ["user@localhost", "admin@intranet", "test@server"];
    for (const email of cases) {
      const result = resendVerificationSchema.safeParse({ email });
      expect(result.success).toBe(false);
    }
  });

  it("exports ResendVerificationInput type matching schema", () => {
    const valid: ResendVerificationInput = {
      email: "test@example.com",
    };
    expect(resendVerificationSchema.safeParse(valid).success).toBe(true);
  });
});

describe("loginSchema", () => {
  it("accepts valid login input", () => {
    const result = loginSchema.safeParse({
      email: "jonathan@example.com",
      password: "securepass123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("jonathan@example.com");
      expect(result.data.password).toBe("securepass123");
    }
  });

  it("trims and lowercases email", () => {
    const result = loginSchema.safeParse({
      email: "  USER@EXAMPLE.COM  ",
      password: "password123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("rejects empty email", () => {
    const result = loginSchema.safeParse({
      email: "",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email formats", () => {
    const cases = ["not-an-email", "missing@", "@nodomain", ""];
    for (const email of cases) {
      const result = loginSchema.safeParse({
        email,
        password: "password123",
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects emails without a TLD (e.g., user@localhost)", () => {
    const cases = ["user@localhost", "admin@intranet", "test@server"];
    for (const email of cases) {
      const result = loginSchema.safeParse({
        email,
        password: "password123",
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts password of any length >= 1 (no min-8 enforcement on login)", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "a",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing fields", () => {
    expect(loginSchema.safeParse({}).success).toBe(false);
    expect(loginSchema.safeParse({ email: "test@example.com" }).success).toBe(false);
    expect(loginSchema.safeParse({ password: "pass" }).success).toBe(false);
  });

  it("exports LoginInput type matching schema", () => {
    const valid: LoginInput = {
      email: "test@example.com",
      password: "password123",
    };
    expect(loginSchema.safeParse(valid).success).toBe(true);
  });
});

describe("requestPasswordResetSchema", () => {
  it("accepts valid email", () => {
    const result = requestPasswordResetSchema.safeParse({
      email: "test@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("trims and lowercases email", () => {
    const result = requestPasswordResetSchema.safeParse({
      email: "  USER@EXAMPLE.COM  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("rejects invalid email formats", () => {
    const cases = ["not-an-email", "missing@", "@nodomain", ""];
    for (const email of cases) {
      const result = requestPasswordResetSchema.safeParse({ email });
      expect(result.success).toBe(false);
    }
  });

  it("rejects emails without a TLD (e.g., user@localhost)", () => {
    const cases = ["user@localhost", "admin@intranet", "test@server"];
    for (const email of cases) {
      const result = requestPasswordResetSchema.safeParse({ email });
      expect(result.success).toBe(false);
    }
  });

  it("exports RequestPasswordResetInput type matching schema", () => {
    const valid: RequestPasswordResetInput = {
      email: "test@example.com",
    };
    expect(requestPasswordResetSchema.safeParse(valid).success).toBe(true);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts valid password (8+ characters)", () => {
    const result = resetPasswordSchema.safeParse({
      password: "newpassword123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts password exactly 8 characters", () => {
    const result = resetPasswordSchema.safeParse({
      password: "12345678",
    });
    expect(result.success).toBe(true);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = resetPasswordSchema.safeParse({
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = resetPasswordSchema.safeParse({
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("exports ResetPasswordInput type matching schema", () => {
    const valid: ResetPasswordInput = {
      password: "newpassword123",
    };
    expect(resetPasswordSchema.safeParse(valid).success).toBe(true);
  });
});

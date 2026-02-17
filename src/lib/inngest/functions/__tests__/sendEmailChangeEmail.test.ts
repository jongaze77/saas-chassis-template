import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies BEFORE importing the module under test
vi.mock("@/lib/email/resend", async () => {
  const { appConfig } = await import("@/lib/config");
  return {
    resend: {
      emails: {
        send: vi.fn(),
      },
    },
    EMAIL_FROM: appConfig.email.from,
  };
});

vi.mock("@/lib/email/templates/emailChange", () => ({
  EmailChange: vi.fn().mockReturnValue({ type: "div", props: {} }),
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXTAUTH_URL: "https://example.com",
    RESEND_API_KEY: "test-key",
    INNGEST_EVENT_KEY: "test-event-key",
    INNGEST_SIGNING_KEY: "test-signing-key",
    DATABASE_URL: "test-db-url",
    NEXTAUTH_SECRET: "test-secret",
    NODE_ENV: "test",
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/inngest/client", () => {
  const inngestModule = vi.importActual<typeof import("inngest")>("inngest");
  return inngestModule.then((m) => ({
    inngest: new m.Inngest({
      id: "test",
      schemas: new m.EventSchemas().fromRecord<{
        "auth/email-change.requested": {
          data: { email: string; name: string; token: string };
        };
      }>(),
    }),
  }));
});

import { appConfig } from "@/lib/config";
import { resend } from "@/lib/email/resend";
import { EmailChange } from "@/lib/email/templates/emailChange";
import { sendEmailChangeEmail } from "@/lib/inngest/functions/sendEmailChangeEmail";
import { logger } from "@/lib/logger";

// Helper: extract and invoke the Inngest function handler directly
// Inngest createFunction returns an object with a `fn` property containing the handler
type InngestFnObject = {
  fn: (ctx: { event: { data: { email: string; name: string; token: string } } }) => Promise<void>;
};

function getHandler() {
  return (sendEmailChangeEmail as unknown as InngestFnObject).fn;
}

describe("sendEmailChangeEmail Inngest function", () => {
  const handler = getHandler();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is defined and has a handler", () => {
    expect(sendEmailChangeEmail).toBeDefined();
    expect(handler).toBeDefined();
    expect(typeof handler).toBe("function");
  });

  it("sends email change verification email via Resend with correct parameters", async () => {
    vi.mocked(resend.emails.send).mockResolvedValueOnce({
      data: { id: "email-123" },
      error: null,
      headers: null,
    });

    await handler({
      event: {
        data: {
          email: "newemail@example.com",
          name: "Test User",
          token: "email-change-token-123",
        },
      },
    });

    expect(resend.emails.send).toHaveBeenCalledWith({
      from: appConfig.email.from,
      to: "newemail@example.com",
      subject: `Confirm your new email address - ${appConfig.name}`,
      react: expect.anything(),
    });
  });

  it("constructs correct verification URL from env.NEXTAUTH_URL", async () => {
    vi.mocked(resend.emails.send).mockResolvedValueOnce({
      data: { id: "email-url-test" },
      error: null,
      headers: null,
    });

    await handler({
      event: {
        data: {
          email: "url@example.com",
          name: "URL User",
          token: "my-unique-token",
        },
      },
    });

    expect(EmailChange).toHaveBeenCalledWith({
      verificationUrl: "https://example.com/confirm-email-change/my-unique-token",
      name: "URL User",
      newEmail: "url@example.com",
    });
  });

  it("logs success after sending email", async () => {
    vi.mocked(resend.emails.send).mockResolvedValueOnce({
      data: { id: "email-789" },
      error: null,
      headers: null,
    });

    await handler({
      event: {
        data: {
          email: "success@example.com",
          name: "Success User",
          token: "success-token",
        },
      },
    });

    // Email is masked for PII protection
    expect(logger.info).toHaveBeenCalledWith("Email change verification email sent", {
      email: "s***@example.com",
    });
  });

  it("throws and logs error when Resend returns an error", async () => {
    vi.mocked(resend.emails.send).mockResolvedValueOnce({
      data: null,
      error: { name: "rate_limit_exceeded" as const, message: "Rate limit exceeded", statusCode: 429 },
      headers: null,
    });

    await expect(
      handler({
        event: {
          data: {
            email: "fail@example.com",
            name: "Fail User",
            token: "fail-token",
          },
        },
      }),
    ).rejects.toThrow("Failed to send email change verification email: Rate limit exceeded");

    // Email is masked for PII protection
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to send email change verification email",
      {
        email: "f***@example.com",
        error: "Rate limit exceeded",
      },
    );
  });

  it("calls EmailChange template with name, URL, and newEmail", async () => {
    vi.mocked(resend.emails.send).mockResolvedValueOnce({
      data: { id: "email-template" },
      error: null,
      headers: null,
    });

    await handler({
      event: {
        data: {
          email: "template@example.com",
          name: "Template User",
          token: "template-token",
        },
      },
    });

    expect(EmailChange).toHaveBeenCalledTimes(1);
    expect(EmailChange).toHaveBeenCalledWith({
      verificationUrl: "https://example.com/confirm-email-change/template-token",
      name: "Template User",
      newEmail: "template@example.com",
    });
  });
});

import { EMAIL_FROM, resend } from "@/lib/email/resend";
import { EmailChange } from "@/lib/email/templates/emailChange";
import { env } from "@/lib/env";
import { inngest } from "@/lib/inngest/client";
import { logger } from "@/lib/logger";
import { maskEmail } from "@/lib/pii";

export const sendEmailChangeEmail = inngest.createFunction(
  { id: "send-email-change-email" },
  { event: "auth/email-change.requested" },
  async ({ event }) => {
    const { email, name, token } = event.data;
    const verificationUrl = `${env.NEXTAUTH_URL}/confirm-email-change/${token}`;

    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Confirm your new email address - SEO PluginPress",
      react: EmailChange({ verificationUrl, name, newEmail: email }),
    });

    if (error) {
      logger.error("Failed to send email change verification email", {
        email: maskEmail(email),
        error: error.message,
      });
      throw new Error(`Failed to send email change verification email: ${error.message}`);
    }

    logger.info("Email change verification email sent", { email: maskEmail(email) });
  },
);

import { appConfig } from "@/lib/config";
import { EMAIL_FROM, resend } from "@/lib/email/resend";
import { PasswordReset } from "@/lib/email/templates/passwordReset";
import { env } from "@/lib/env";
import { inngest } from "@/lib/inngest/client";
import { logger } from "@/lib/logger";
import { maskEmail } from "@/lib/pii";

export const sendPasswordResetEmail = inngest.createFunction(
  { id: "send-password-reset-email" },
  { event: "auth/password-reset.requested" },
  async ({ event }) => {
    const { email, name, token } = event.data;
    const resetUrl = `${env.NEXTAUTH_URL}/reset-password/${token}`;

    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: `Reset your password - ${appConfig.name}`,
      react: PasswordReset({ resetUrl, name }),
    });

    if (error) {
      logger.error("Failed to send password reset email", { email: maskEmail(email), error: error.message });
      throw new Error(`Failed to send password reset email: ${error.message}`);
    }

    logger.info("Password reset email sent", { email: maskEmail(email) });
  },
);

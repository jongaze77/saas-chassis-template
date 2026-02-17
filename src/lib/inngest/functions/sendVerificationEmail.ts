import { EMAIL_FROM, resend } from "@/lib/email/resend";
import { EmailVerification } from "@/lib/email/templates/emailVerification";
import { env } from "@/lib/env";
import { inngest } from "@/lib/inngest/client";
import { logger } from "@/lib/logger";
import { maskEmail } from "@/lib/pii";

export const sendVerificationEmail = inngest.createFunction(
  { id: "send-verification-email" },
  { event: "auth/verification.requested" },
  async ({ event }) => {
    const { email, name, token } = event.data;
    const verificationUrl = `${env.NEXTAUTH_URL}/verify-email/${token}`;

    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Verify your email - SEO PluginPress",
      react: EmailVerification({ verificationUrl, name }),
    });

    if (error) {
      logger.error("Failed to send verification email", { email: maskEmail(email), error: error.message });
      throw new Error(`Failed to send verification email: ${error.message}`);
    }

    logger.info("Verification email sent", { email: maskEmail(email) });
  },
);

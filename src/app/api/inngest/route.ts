import { serve } from "inngest/next";

import { env } from "@/lib/env";
import { inngest } from "@/lib/inngest/client";
import { sendEmailChangeEmail } from "@/lib/inngest/functions/sendEmailChangeEmail";
import { sendPasswordResetEmail } from "@/lib/inngest/functions/sendPasswordResetEmail";
import { sendVerificationEmail } from "@/lib/inngest/functions/sendVerificationEmail";

export const { GET, PUT, POST } = serve({
  client: inngest,
  functions: [sendVerificationEmail, sendPasswordResetEmail, sendEmailChangeEmail],
  signingKey: env.INNGEST_SIGNING_KEY,
});

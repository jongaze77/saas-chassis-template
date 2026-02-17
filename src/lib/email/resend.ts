import { Resend } from "resend";

import { appConfig } from "@/lib/config";
import { env } from "@/lib/env";

export const resend = new Resend(env.RESEND_API_KEY);

export const EMAIL_FROM = appConfig.email.from;

import { z } from "zod";

import {
  SETTINGS_INVALID_EMAIL,
  SETTINGS_NAME_REQUIRED,
  SETTINGS_NAME_TOO_LONG,
  SETTINGS_PASSWORD_REQUIRED,
} from "@/lib/constants/settings-errors";

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, SETTINGS_NAME_REQUIRED)
    .max(100, SETTINGS_NAME_TOO_LONG),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const requestEmailChangeSchema = z.object({
  newEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email(SETTINGS_INVALID_EMAIL)
    .refine((email) => email.split("@")[1]?.includes("."), {
      message: SETTINGS_INVALID_EMAIL,
    }),
  currentPassword: z.string().min(1, SETTINGS_PASSWORD_REQUIRED),
});

export type RequestEmailChangeInput = z.infer<typeof requestEmailChangeSchema>;

import { z } from "zod";

export const registrationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address")
    .refine((email) => email.split("@")[1]?.includes("."), {
      message: "Please enter a valid email address",
    }),
  // TODO: [Epic 1 — Tech Debt: Password Strength] Add common password blocking
  // (e.g., top 10k list) and/or password strength scoring (e.g., zxcvbn) to
  // prevent weak passwords beyond the minimum length requirement.
  // Tracked: Epic 1, backlog (post-MVP enhancement).
  password: z
    .string()
    .min(8, "Password must be at least 8 characters"),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

export const resendVerificationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address")
    .refine((email) => email.split("@")[1]?.includes("."), {
      message: "Please enter a valid email address",
    }),
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address")
    .refine((email) => email.split("@")[1]?.includes("."), {
      message: "Please enter a valid email address",
    }),
  // Do NOT enforce min 8 here — a min-length error would reveal the email exists.
  // The actual password strength was enforced at registration time.
  password: z
    .string()
    .min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const requestPasswordResetSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address")
    .refine((email) => email.split("@")[1]?.includes("."), {
      message: "Please enter a valid email address",
    }),
});

export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters"),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

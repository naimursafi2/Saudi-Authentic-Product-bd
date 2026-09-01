import { z } from "zod";

// Only requirement is length — mirrors the live check in
// frontend/src/lib/passwordStrength.ts.
const passwordField = z.string().min(8, "Password must be at least 8 characters").max(128);

const phoneField = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{7,15}$/, "Enter a valid phone number")
  .optional();

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
    email: z.string().trim().email("Enter a valid email address").toLowerCase(),
    phone: phoneField,
    password: passwordField,
    confirmPassword: z.string().min(1, "Please confirm your password"),
    address: z
      .object({
        fullAddress: z.string().trim().min(3).max(300),
        district: z.string().trim().min(1).max(80),
        cityArea: z.string().trim().min(1).max(120),
      })
      .optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => !data.address || !!data.phone, {
    message: "A phone number is required to save an address",
    path: ["phone"],
  });

export const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1),
});

export const googleAuthSchema = z.object({
  idToken: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordField,
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    newPassword: passwordField,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
});

export const verifyRegistrationOtpSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const resendRegistrationOtpSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type VerifyRegistrationOtpInput = z.infer<typeof verifyRegistrationOtpSchema>;
export type ResendRegistrationOtpInput = z.infer<typeof resendRegistrationOtpSchema>;

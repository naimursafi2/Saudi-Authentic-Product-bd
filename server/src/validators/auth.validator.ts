import { z } from "zod";

// At least one lowercase letter, one uppercase letter and one digit — mirrors
// the live strength check in frontend/src/lib/passwordStrength.ts.
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(PASSWORD_REGEX, "Password must include an uppercase letter, a lowercase letter and a number");

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

/** A 6-digit TOTP code or a 10-character recovery code. */
const twoFactorCodeField = z.string().trim().min(6).max(20);

export const enableTwoFactorSchema = z.object({
  code: twoFactorCodeField,
});

export const disableTwoFactorSchema = z.object({
  password: z.string().min(1),
});

export const verifyTwoFactorLoginSchema = z.object({
  challengeToken: z.string().min(1),
  code: twoFactorCodeField,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type EnableTwoFactorInput = z.infer<typeof enableTwoFactorSchema>;
export type DisableTwoFactorInput = z.infer<typeof disableTwoFactorSchema>;
export type VerifyTwoFactorLoginInput = z.infer<typeof verifyTwoFactorLoginSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

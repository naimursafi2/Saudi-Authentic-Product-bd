import { api } from "./client";
import type { ApiUser } from "@/types/api";
import type { Permission } from "@/lib/permissions";

export interface RegisterAddressPayload {
  fullAddress: string;
  district: string;
  cityArea: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone?: string;
  address?: RegisterAddressPayload;
}

export async function register(payload: RegisterPayload) {
  return api.post<{ user: ApiUser; accessToken: string }>("/auth/register", payload);
}

/** A 2FA-enabled account returns a challenge instead of a session — see
 * `verifyTwoFactorLogin` for the second step. */
export type LoginResponse =
  | { user: ApiUser; accessToken: string; requiresTwoFactor?: undefined }
  | { requiresTwoFactor: true; challengeToken: string; user?: undefined };

export async function login(email: string, password: string) {
  return api.post<LoginResponse>("/auth/login", { email, password });
}

export async function verifyTwoFactorLogin(challengeToken: string, code: string) {
  return api.post<{ user: ApiUser; accessToken: string }>("/auth/2fa/verify", { challengeToken, code });
}

export async function startTwoFactorSetup() {
  return api.post<{ secret: string; otpauthUrl: string; qrDataUrl: string }>("/auth/2fa/setup");
}

export async function enableTwoFactor(code: string) {
  return api.post<{ recoveryCodes: string[] }>("/auth/2fa/enable", { code });
}

export async function disableTwoFactor(password: string) {
  return api.post<null>("/auth/2fa/disable", { password });
}

export async function googleAuth(idToken: string) {
  return api.post<{ user: ApiUser; accessToken: string }>("/auth/google", { idToken });
}

export async function logout() {
  return api.post<null>("/auth/logout");
}

export async function getMe() {
  return api.get<{ user: ApiUser; permissions: Permission[]; impersonatedBy?: string }>("/auth/me");
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return api.patch<null>("/auth/change-password", { currentPassword, newPassword });
}

export async function forgotPassword(email: string) {
  return api.post<null>("/auth/forgot-password", { email });
}

export async function resetPassword(token: string, newPassword: string, confirmPassword: string) {
  return api.post<null>("/auth/reset-password", { token, newPassword, confirmPassword });
}

export type VerifyEmailStatus = "verified" | "already-verified";

export async function verifyEmail(token: string) {
  return api.post<{ status: VerifyEmailStatus }>("/auth/verify-email", { token });
}

export async function resendVerification(email: string) {
  return api.post<null>("/auth/resend-verification", { email });
}

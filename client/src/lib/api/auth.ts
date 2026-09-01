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

// login/googleAuth/verifyRegistrationOtp all return `permissions` alongside
// `user` (computed once, server-side, in the same request) so the caller can
// set full auth state immediately — see AuthContext — instead of following
// up with a second `GET /auth/me` round-trip just to learn what the user is
// allowed to do.
//
// `register` itself does NOT sign the account in — it only creates the
// (unverified) account and emails a 6-digit code; the account isn't usable
// until `verifyRegistrationOtp` confirms that code. This is the anti-bot
// gate: see auth.service.ts's registerCustomer for why.
export async function register(payload: RegisterPayload) {
  return api.post<{ requiresOtpVerification: true; email: string }>("/auth/register", payload);
}

export async function verifyRegistrationOtp(email: string, code: string) {
  return api.post<{ user: ApiUser; accessToken: string; permissions: Permission[] }>(
    "/auth/verify-registration-otp",
    { email, code }
  );
}

export async function resendRegistrationOtp(email: string) {
  return api.post<null>("/auth/resend-registration-otp", { email });
}

export async function login(email: string, password: string) {
  return api.post<{ user: ApiUser; accessToken: string; permissions: Permission[] }>("/auth/login", {
    email,
    password,
  });
}

export async function googleAuth(idToken: string) {
  return api.post<{ user: ApiUser; accessToken: string; permissions: Permission[] }>("/auth/google", { idToken });
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

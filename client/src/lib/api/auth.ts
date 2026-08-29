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

// register/login/googleAuth all return `permissions` alongside `user` now
// (computed once, server-side, in the same request) so the caller can set
// full auth state immediately — see AuthContext — instead of following up
// with a second `GET /auth/me` round-trip just to learn what the user is
// allowed to do.
export async function register(payload: RegisterPayload) {
  return api.post<{ user: ApiUser; accessToken: string; permissions: Permission[] }>("/auth/register", payload);
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

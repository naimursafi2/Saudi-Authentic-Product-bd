import { api } from "./client";
import type { ApiUser } from "@/types/api";

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

export async function login(email: string, password: string) {
  return api.post<{ user: ApiUser; accessToken: string }>("/auth/login", { email, password });
}

export async function googleAuth(idToken: string) {
  return api.post<{ user: ApiUser; accessToken: string }>("/auth/google", { idToken });
}

export async function logout() {
  return api.post<null>("/auth/logout");
}

export async function getMe() {
  return api.get<{ user: ApiUser }>("/auth/me");
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

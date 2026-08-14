import { api } from "./client";
import type { ApiAddress, ApiUser, Role } from "@/types/api";

export interface AddAddressPayload {
  label: string;
  fullAddress: string;
  district: string;
  cityArea: string;
  phone: string;
  isDefault?: boolean;
}

export async function addAddress(payload: AddAddressPayload) {
  return api.post<{ user: ApiUser }>("/users/me/addresses", payload);
}

export async function removeAddress(addressId: string) {
  return api.delete<{ user: ApiUser }>(`/users/me/addresses/${addressId}`);
}

export interface CreateStaffPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: "employee" | "co_admin" | "admin";
  staffMeta?: {
    employeeId: string;
    department?: string;
    designation?: string;
    baseSalaryBDT?: number;
  };
}

export async function createStaff(payload: CreateStaffPayload) {
  return api.post<{ user: ApiUser }>("/users", payload);
}

export async function listUsers(params: { role?: Role; search?: string; page?: number; limit?: number } = {}) {
  const search = new URLSearchParams();
  if (params.role) search.set("role", params.role);
  if (params.search) search.set("search", params.search);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return api.get<{ users: ApiUser[] }>(`/users${qs ? `?${qs}` : ""}`);
}

export async function getUser(id: string) {
  return api.get<{ user: ApiUser }>(`/users/${id}`);
}

export async function updateUserRole(id: string, role: Role) {
  return api.patch<{ user: ApiUser }>(`/users/${id}/role`, { role });
}

export async function updateUserStatus(id: string, isActive: boolean) {
  return api.patch<{ user: ApiUser }>(`/users/${id}/status`, { isActive });
}

export async function updateStaffMeta(
  id: string,
  payload: { department?: string; designation?: string; baseSalaryBDT?: number }
) {
  return api.patch<{ user: ApiUser }>(`/users/${id}/staff-meta`, payload);
}

export type { ApiAddress };

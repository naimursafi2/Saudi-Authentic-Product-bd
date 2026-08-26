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

export type UpdateAddressPayload = Partial<AddAddressPayload>;

export async function updateAddress(addressId: string, payload: UpdateAddressPayload) {
  return api.patch<{ user: ApiUser }>(`/users/me/addresses/${addressId}`, payload);
}

export async function removeAddress(addressId: string) {
  return api.delete<{ user: ApiUser }>(`/users/me/addresses/${addressId}`);
}

export interface UpdateMyProfilePayload {
  name?: string;
  phone?: string;
}

export async function updateMyProfile(payload: UpdateMyProfilePayload) {
  return api.patch<{ user: ApiUser }>("/users/me", payload);
}

export async function updateMyAvatar(file: File) {
  const formData = new FormData();
  formData.append("avatar", file);
  return api.patchForm<{ user: ApiUser }>("/users/me/avatar", formData);
}

export async function removeMyAvatar() {
  return api.delete<{ user: ApiUser }>("/users/me/avatar");
}

export interface CreateStaffPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: "employee" | "delivery_agent" | "co_admin" | "order_manager" | "admin";
  staffMeta?: {
    employeeId: string;
    department?: string;
    designation?: string;
    baseSalaryBDT?: number;
    joinedAt?: string;
    nidNumber?: string;
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
  payload: {
    department?: string;
    designation?: string;
    baseSalaryBDT?: number;
    joinedAt?: string;
    nidNumber?: string;
  }
) {
  return api.patch<{ user: ApiUser }>(`/users/${id}/staff-meta`, payload);
}

export async function uploadStaffNidImage(id: string, file: File) {
  const form = new FormData();
  form.set("nidImage", file);
  return api.patchForm<{ user: ApiUser }>(`/users/${id}/staff-meta/nid-image`, form);
}

export async function unlockUser(id: string) {
  return api.patch<{ user: ApiUser }>(`/users/${id}/unlock`, {});
}

export async function impersonateUser(id: string) {
  return api.post<{ accessToken: string; user: ApiUser }>(`/users/${id}/impersonate`);
}

export type { ApiAddress };

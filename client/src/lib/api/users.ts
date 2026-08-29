import { api } from "./client";
import type { ApiAddress, ApiUser, CustomerStats, Role } from "@/types/api";

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

export async function listUsers(
  params: {
    role?: Role;
    search?: string;
    isActive?: boolean;
    isEmailVerified?: boolean;
    page?: number;
    limit?: number;
  } = {}
) {
  const search = new URLSearchParams();
  if (params.role) search.set("role", params.role);
  if (params.search) search.set("search", params.search);
  if (params.isActive !== undefined) search.set("isActive", String(params.isActive));
  if (params.isEmailVerified !== undefined) search.set("isEmailVerified", String(params.isEmailVerified));
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return api.get<{ users: ApiUser[] }>(`/users${qs ? `?${qs}` : ""}`);
}

/** Live, never-hardcoded counts backing the Customer Management page and the Campaign dashboard's audience stats. */
export async function getCustomerStats() {
  return api.get<CustomerStats>("/users/customer-stats");
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

/** Employment fields apply immediately; an `nidNumber` change comes back with
 * a `pendingActionId` for everyone but Super Admin — it is queued for approval,
 * not applied. */
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
  return api.patch<{ user: ApiUser; pendingActionId?: string }>(`/users/${id}/staff-meta`, payload);
}

/** Returns a `pendingActionId` unless the caller is Super Admin, in which case
 * the scan is replaced immediately. */
export async function uploadStaffNidImage(id: string, file: File) {
  const form = new FormData();
  form.set("nidImage", file);
  return api.patchForm<{ user: ApiUser; pendingActionId?: string }>(
    `/users/${id}/staff-meta/nid-image`,
    form
  );
}

/** A staff member asking Super Admin to correct their own identity document.
 * Always a request — this endpoint has no path that writes the record. */
export async function requestMyNidEdit(payload: { reason: string; nidNumber?: string }, nidImage?: File) {
  const form = new FormData();
  form.set("reason", payload.reason);
  if (payload.nidNumber) form.set("nidNumber", payload.nidNumber);
  if (nidImage) form.set("nidImage", nidImage);
  return api.postForm<{ pendingActionId: string }>("/users/me/staff-meta/nid-edit-request", form);
}

export async function unlockUser(id: string) {
  return api.patch<{ user: ApiUser }>(`/users/${id}/unlock`, {});
}

export async function impersonateUser(id: string) {
  return api.post<{ accessToken: string; user: ApiUser }>(`/users/${id}/impersonate`);
}

export type { ApiAddress };

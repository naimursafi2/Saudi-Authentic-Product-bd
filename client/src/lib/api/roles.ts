import { api } from "./client";
import type { ApiPermissionGroup, ApiRole, ApiUser, ApiUserPermissions } from "@/types/api";

export interface RolePayload {
  key: string;
  name: string;
  description?: string;
  permissions: string[];
  isActive?: boolean;
}

export async function listRoles() {
  return api.get<{ roles: ApiRole[] }>("/roles");
}

export async function listPermissions() {
  return api.get<{ permissions: string[]; groups: ApiPermissionGroup[]; sensitive: string[] }>(
    "/roles/permissions"
  );
}

export async function createRole(payload: RolePayload) {
  return api.post<{ role: ApiRole }>("/roles", payload);
}

/** Partial update. A built-in role accepts only `permissions`, and only from
 * a Super Admin — the server enforces both. */
export async function updateRole(id: string, payload: Partial<RolePayload>) {
  return api.patch<{ role: ApiRole }>(`/roles/${id}`, payload);
}

export async function deleteRole(id: string) {
  return api.delete<null>(`/roles/${id}`);
}

/** `roleId: null` clears the assignment, leaving the user's built-in role. */
export async function assignRoleToUser(userId: string, roleId: string | null) {
  return api.patch<{ user: ApiUser }>(`/roles/users/${userId}`, { roleId });
}

export async function getUserPermissions(userId: string) {
  return api.get<ApiUserPermissions>(`/roles/users/${userId}`);
}

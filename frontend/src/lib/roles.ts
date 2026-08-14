import type { Role } from "@/types/api";

/** Mirrors backend/src/constants/roles.ts — kept in sync manually since the two apps don't share code. */
export const ROLES: Role[] = ["customer", "employee", "co_admin", "admin", "super_admin"];

export const STAFF_ROLES: Role[] = ["employee", "co_admin", "admin", "super_admin"];

export const ADMIN_PORTAL_ROLES: Role[] = ["co_admin", "admin", "super_admin"];

export const STAFF_MANAGER_ROLES: Role[] = ["admin", "super_admin"];

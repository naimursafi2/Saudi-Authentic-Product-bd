/**
 * All roles recognised by the platform. Ordered roughly by privilege level.
 *
 * - customer    : shoppers on the public storefront
 * - employee    : internal staff (support, warehouse, etc.) — Employee Portal
 * - co_admin    : trusted staff with most Admin Portal access, fewer
 *                 destructive/HR permissions than admin
 * - admin       : full operational control (products, orders, employees...)
 * - super_admin : everything admin can do, plus managing other admins
 */
export const ROLES = [
  "customer",
  "employee",
  "co_admin",
  "admin",
  "super_admin",
] as const;

export type Role = (typeof ROLES)[number];

/** Roles that are internal staff (i.e. not a storefront customer). */
export const STAFF_ROLES: Role[] = ["employee", "co_admin", "admin", "super_admin"];

/** Roles allowed to access the Admin Portal (`/admin`). */
export const ADMIN_PORTAL_ROLES: Role[] = ["co_admin", "admin", "super_admin"];

/** Roles allowed to manage other staff accounts and role assignment. */
export const STAFF_MANAGER_ROLES: Role[] = ["admin", "super_admin"];

export function isStaffRole(role: string): role is Role {
  return (STAFF_ROLES as string[]).includes(role);
}

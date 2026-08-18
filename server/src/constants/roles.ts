/**
 * All roles recognised by the platform. Ordered roughly by privilege level.
 *
 * - customer       : shoppers on the public storefront
 * - employee       : internal staff (support, warehouse, etc.) — Employee Portal
 * - delivery_agent : couriers with access ONLY to their own assigned orders —
 *                     own minimal Delivery Portal, never reaches `/admin`
 * - co_admin       : trusted staff with most Admin Portal access, fewer
 *                     destructive/HR permissions than admin
 * - order_manager  : Admin Portal access scoped to Orders — verifies, dispatches,
 *                     and assigns orders to delivery agents; no products/users/
 *                     coupons/finance/settings access
 * - admin          : full operational control (products, orders, employees...)
 * - super_admin    : everything admin can do, plus managing other admins
 */
export const ROLES = [
  "customer",
  "employee",
  "delivery_agent",
  "co_admin",
  "order_manager",
  "admin",
  "super_admin",
] as const;

export type Role = (typeof ROLES)[number];

/** Roles that are internal staff (i.e. not a storefront customer). */
export const STAFF_ROLES: Role[] = [
  "employee",
  "delivery_agent",
  "co_admin",
  "order_manager",
  "admin",
  "super_admin",
];

/** Roles allowed to access the Admin Portal (`/admin`). `delivery_agent` is
 * deliberately excluded — it gets its own minimal Delivery Portal instead,
 * see `frontend/src/app/delivery`. */
export const ADMIN_PORTAL_ROLES: Role[] = ["co_admin", "order_manager", "admin", "super_admin"];

/** Roles allowed to manage other staff accounts and role assignment. */
export const STAFF_MANAGER_ROLES: Role[] = ["admin", "super_admin"];

export function isStaffRole(role: string): role is Role {
  return (STAFF_ROLES as string[]).includes(role);
}

import type { Role } from "@/types/api";

/** Mirrors backend/src/constants/roles.ts — kept in sync manually since the two apps don't share code. */
export const ROLES: Role[] = [
  "customer",
  "employee",
  "delivery_agent",
  "co_admin",
  "order_manager",
  "admin",
  "super_admin",
];

export const STAFF_ROLES: Role[] = ["employee", "delivery_agent", "co_admin", "order_manager", "admin", "super_admin"];

/** `delivery_agent` is deliberately excluded — it gets its own Delivery Portal, not `/admin`. */
export const ADMIN_PORTAL_ROLES: Role[] = ["co_admin", "order_manager", "admin", "super_admin"];

export const STAFF_MANAGER_ROLES: Role[] = ["admin", "super_admin"];

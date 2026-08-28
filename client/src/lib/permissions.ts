/**
 * Mirrors `server/src/constants/permissions.ts` — kept in sync manually,
 * since the two apps share no code (same arrangement as `lib/roles.ts` and
 * `constants/roles.ts`).
 *
 * This list drives what the admin panel *shows*. It is never the security
 * boundary: every permission is re-checked server-side by
 * `requirePermission(...)` on the route itself, so a user who edits their own
 * client state gains a visible menu item and nothing else — the API still
 * answers 403.
 */
export const PERMISSIONS = [
  "products.view",
  "products.create",
  "products.edit",
  "products.delete",
  "categories.create",
  "categories.edit",
  "categories.delete",
  "orders.view",
  "orders.manage",
  "orders.deliver",
  "inventory.view",
  "inventory.logs.view",
  "inventory.manage",
  "purchases.view",
  "purchases.create",
  "purchases.edit",
  "purchases.delete",
  "employees.view",
  "employees.manage",
  "employees.impersonate",
  "leave.view",
  "leave.manage",
  "tasks.view",
  "tasks.create",
  "tasks.edit",
  "tasks.delete",
  "performance.view",
  "performance.manage",
  "salary.view",
  "salary.manage",
  "marketing.view",
  "marketing.manage",
  "coupons.delete",
  "content.homepage.manage",
  "content.homepage.delete",
  "content.navigation.manage",
  "content.pages.manage",
  "content.branding.manage",
  "settings.manage",
  "reviews.view",
  "reviews.delete",
  "reports.view",
  "finance.view",
  "investments.view",
  "investments.create",
  "expenses.view",
  "expenses.create",
  "expenses.approve",
  "expenses.requestEdit",
  "expenses.edit",
  "refunds.view",
  "refunds.request",
  "refunds.review",
  "refunds.approve",
  "returns.view",
  "returns.request",
  "returns.review",
  "campaigns.view",
  "campaigns.create",
  "campaigns.edit",
  "campaigns.delete",
  "campaigns.approve",
  "campaigns.send",
  "approvals.manage",
  "auditLogs.view",
  "roles.view",
  "roles.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Permissions that mean a user belongs in the Admin Portal. A custom role
 * holding any of these gets through `/admin` without being added to
 * `ADMIN_PORTAL_ROLES` in code — which is the whole point of custom roles.
 *
 * The excluded permissions belong to people who are not admin staff:
 * `orders.deliver` is the Delivery Portal's, and `refunds.request`/
 * `refunds.view`/`returns.request`/`returns.view` are held by ordinary
 * customers for their own orders.
 */
const NON_ADMIN_PORTAL_PERMISSIONS: Permission[] = [
  "orders.deliver",
  "refunds.request",
  "refunds.view",
  "returns.request",
  "returns.view",
];

export function grantsAdminPortalAccess(permissions: Permission[]): boolean {
  return permissions.some((permission) => !NON_ADMIN_PORTAL_PERMISSIONS.includes(permission));
}

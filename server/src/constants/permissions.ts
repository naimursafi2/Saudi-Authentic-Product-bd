import type { Role } from "./roles";

/**
 * Granular permissions — the vocabulary routes are gated with.
 *
 * ## How this relates to the existing role system
 *
 * Roles were, and still are, real: `User.role` is unchanged and every legacy
 * check keeps working. What changed is that routes now ask "does this caller
 * hold permission X?" instead of "is this caller one of these roles?", and a
 * role's answer to that comes from a `Role` document in the database.
 *
 * The seven built-in roles are seeded as `isSystem` Role documents whose
 * permission lists are the `ROLE_DEFAULT_PERMISSIONS` below. Those lists were
 * derived field-by-field from the `authorize(...)` calls that used to sit on
 * each route, so on day one every role can do exactly what it could before —
 * no more, no less. Changing what Admin or Co-Admin can reach is now an edit
 * in the admin panel rather than a code change.
 *
 * ## Adding a permission
 *
 * Add the key here (and to the matching group below so it shows up in the
 * admin panel's checkbox list), then gate the route with
 * `requirePermission("your.key")`. Roles are data and never need a code
 * change; permissions are code, because a permission that no route consults
 * grants nothing. Mirror any addition in `client/src/lib/permissions.ts` —
 * the two apps share no code, same as `constants/roles.ts` and
 * `lib/roles.ts`.
 */
export const PERMISSIONS = [
  // -- Catalog --
  "products.view",
  "products.create",
  "products.edit",
  "products.delete",
  "categories.create",
  "categories.edit",
  "categories.delete",

  // -- Orders & delivery --
  "orders.view",
  "orders.manage",
  "orders.deliver",

  // -- Inventory --
  "inventory.view",
  "inventory.logs.view",
  "inventory.manage",

  // -- Purchasing & shops --
  "shops.view",
  "shops.manage",
  "purchases.view",
  "purchases.create",
  "purchases.edit",
  "purchases.delete",

  // -- Staff & customers --
  "employees.view",
  "employees.manage",
  "employees.impersonate",

  // -- HR --
  "attendance.view",
  "attendance.manage",
  "leave.view",
  "leave.manage",
  "tasks.view",
  "tasks.create",
  "tasks.edit",
  "tasks.delete",
  "performance.view",
  "performance.manage",

  // -- Payroll --
  "salary.view",
  "salary.manage",

  // -- Marketing & storefront content --
  "marketing.view",
  "marketing.manage",
  "coupons.delete",
  "content.homepage.manage",
  "content.homepage.delete",
  "content.navigation.manage",
  "content.pages.manage",
  "settings.manage",

  // -- Reviews --
  "reviews.view",
  "reviews.delete",

  // -- Reporting & finance --
  "reports.view",
  "finance.view",
  "investments.view",
  "investments.create",
  "expenses.view",
  "expenses.create",
  "expenses.approve",
  "refunds.view",
  "refunds.request",
  "refunds.review",
  "refunds.approve",

  // -- Governance --
  "approvals.manage",
  "auditLogs.view",
  "roles.view",
  "roles.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const PERMISSION_SET: ReadonlySet<string> = new Set<string>(PERMISSIONS);

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}

/**
 * Display grouping + human labels for the admin panel's checkbox list. Every
 * permission above appears in exactly one group; the grouping is presentation
 * only and carries no authorization meaning.
 */
export const PERMISSION_GROUPS: { group: string; permissions: { key: Permission; label: string }[] }[] = [
  {
    group: "Catalog",
    permissions: [
      { key: "products.view", label: "View products (admin detail)" },
      { key: "products.create", label: "Create products" },
      { key: "products.edit", label: "Edit products" },
      { key: "products.delete", label: "Delete products" },
      { key: "categories.create", label: "Create categories" },
      { key: "categories.edit", label: "Edit categories" },
      { key: "categories.delete", label: "Delete categories" },
    ],
  },
  {
    group: "Orders & Delivery",
    permissions: [
      { key: "orders.view", label: "View all orders" },
      { key: "orders.manage", label: "Update order status & assign agents" },
      { key: "orders.deliver", label: "Delivery agent actions (own orders)" },
    ],
  },
  {
    group: "Inventory",
    permissions: [
      { key: "inventory.view", label: "View live stock" },
      { key: "inventory.logs.view", label: "View stock logs & low-stock list" },
      { key: "inventory.manage", label: "Adjust stock" },
    ],
  },
  {
    group: "Purchasing & Shops",
    permissions: [
      { key: "shops.view", label: "View shops" },
      { key: "shops.manage", label: "Create, edit & assign shops" },
      { key: "purchases.view", label: "View purchase batches & their costs" },
      { key: "purchases.create", label: "Record purchase batches" },
      { key: "purchases.edit", label: "Edit purchases & their cost items" },
      { key: "purchases.delete", label: "Delete purchase batches" },
    ],
  },
  {
    group: "Staff & Customers",
    permissions: [
      { key: "employees.view", label: "View staff & customer accounts" },
      { key: "employees.manage", label: "Create staff, change roles & status" },
      { key: "employees.impersonate", label: "Support-login as another user" },
    ],
  },
  {
    group: "HR",
    permissions: [
      { key: "attendance.view", label: "View attendance" },
      { key: "attendance.manage", label: "Edit attendance records" },
      { key: "leave.view", label: "View leave requests" },
      { key: "leave.manage", label: "Approve or reject leave" },
      { key: "tasks.view", label: "View all tasks" },
      { key: "tasks.create", label: "Create tasks" },
      { key: "tasks.edit", label: "Edit tasks" },
      { key: "tasks.delete", label: "Delete tasks" },
      { key: "performance.view", label: "View performance reviews" },
      { key: "performance.manage", label: "Write performance reviews" },
    ],
  },
  {
    group: "Payroll",
    permissions: [
      { key: "salary.view", label: "View salary payments" },
      { key: "salary.manage", label: "Record & update salary payments" },
    ],
  },
  {
    group: "Marketing & Content",
    permissions: [
      { key: "marketing.view", label: "View coupons & promotions" },
      { key: "marketing.manage", label: "Create & edit coupons" },
      { key: "coupons.delete", label: "Delete coupons" },
      { key: "content.homepage.manage", label: "Edit homepage banners & sections" },
      { key: "content.homepage.delete", label: "Delete homepage banners & sections" },
      { key: "content.navigation.manage", label: "Edit header nav & footer" },
      { key: "content.pages.manage", label: "Edit About / Contact / Shipping pages" },
      { key: "settings.manage", label: "Edit site settings" },
    ],
  },
  {
    group: "Reviews",
    permissions: [
      { key: "reviews.view", label: "View all reviews" },
      { key: "reviews.delete", label: "Delete reviews" },
    ],
  },
  {
    group: "Reports & Finance",
    permissions: [
      { key: "reports.view", label: "View dashboard & sales reports" },
      { key: "finance.view", label: "View finance summary" },
      { key: "investments.view", label: "View investment ledger" },
      { key: "investments.create", label: "Record investments" },
      { key: "expenses.view", label: "View expenses" },
      { key: "expenses.create", label: "Submit expenses" },
      { key: "expenses.approve", label: "Confirm or reject expenses" },
      { key: "refunds.view", label: "View refunds" },
      { key: "refunds.request", label: "Request a refund" },
      { key: "refunds.review", label: "Review refund requests" },
      { key: "refunds.approve", label: "Approve refunds" },
    ],
  },
  {
    group: "Governance",
    permissions: [
      { key: "approvals.manage", label: "Grant or deny pending approvals" },
      { key: "auditLogs.view", label: "View audit logs" },
      { key: "roles.view", label: "View roles & permissions" },
      { key: "roles.manage", label: "Create, edit & delete roles" },
    ],
  },
];

/**
 * Permissions that hand out authority over the authorization system itself.
 * A non-Super-Admin can only grant a permission they already hold (see
 * role.service.ts), which covers escalation in general; these are called out
 * because granting one is how a role could later be used to grant everything
 * else, so they are worth seeing flagged in the admin panel.
 */
export const SENSITIVE_PERMISSIONS: Permission[] = [
  "roles.manage",
  "employees.manage",
  "employees.impersonate",
  "approvals.manage",
];

/**
 * The permission set each built-in role starts with. Transcribed from the
 * `authorize(...)` role lists that previously guarded each route, so these
 * are a description of the existing system rather than a new policy.
 *
 * `super_admin` is deliberately absent: it is special-cased to hold every
 * permission, always, and its role document cannot be edited. Without that
 * escape hatch a mistaken edit could lock every human out of the panel.
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<Exclude<Role, "super_admin">, Permission[]> = {
  customer: ["refunds.request", "refunds.view"],

  employee: ["orders.view", "inventory.view", "auditLogs.view"],

  delivery_agent: ["orders.deliver", "auditLogs.view"],

  order_manager: [
    "orders.view",
    "orders.manage",
    "inventory.view",
    "refunds.view",
    "refunds.request",
    "refunds.review",
    "auditLogs.view",
  ],

  co_admin: [
    "products.view",
    "products.create",
    "products.edit",
    // Co-Admin may *request* product deletion — the approval gate in
    // product.service.ts turns it into a pending action rather than an
    // immediate delete. Admin has no product-deletion access at all, which
    // is why it is absent from the admin list below.
    "products.delete",
    "categories.create",
    "categories.edit",
    "orders.view",
    "orders.manage",
    "inventory.view",
    "inventory.logs.view",
    "inventory.manage",
    // Purchasing: a Co-Admin records purchases and their cost items, but only
    // for the shops assigned to them (purchase.service.ts scopes every read
    // and write to `User.assignedShops`) and never deletes one.
    "shops.view",
    "purchases.view",
    "purchases.create",
    "purchases.edit",
    "employees.view",
    "attendance.view",
    "attendance.manage",
    "leave.view",
    "leave.manage",
    "tasks.view",
    "tasks.create",
    "tasks.edit",
    "performance.view",
    "performance.manage",
    "marketing.view",
    "marketing.manage",
    "content.homepage.manage",
    "reviews.view",
    "reviews.delete",
    "reports.view",
    "expenses.view",
    "expenses.create",
    "refunds.view",
    "refunds.request",
    "auditLogs.view",
    "roles.view",
  ],

  admin: [
    "products.view",
    "products.create",
    "products.edit",
    // No "products.delete" — deletion is Co-Admin (as a request) and Super
    // Admin only, a deliberate reduction from Admin's otherwise-broad
    // product control.
    "categories.create",
    "categories.edit",
    "categories.delete",
    "orders.view",
    "orders.manage",
    "inventory.view",
    "inventory.logs.view",
    "inventory.manage",
    "shops.view",
    "shops.manage",
    "purchases.view",
    "purchases.create",
    "purchases.edit",
    "purchases.delete",
    "employees.view",
    "employees.manage",
    "attendance.view",
    "attendance.manage",
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
    "settings.manage",
    "reviews.view",
    "reviews.delete",
    "reports.view",
    "finance.view",
    "investments.view",
    "expenses.view",
    "expenses.create",
    "expenses.approve",
    "refunds.view",
    "refunds.request",
    "refunds.review",
    "refunds.approve",
    "auditLogs.view",
    "roles.view",
    "roles.manage",
  ],
};

/** Every permission, used for `super_admin` and for validation. */
export const ALL_PERMISSIONS: Permission[] = [...PERMISSIONS];

/**
 * Permissions that, if held, mean a user belongs in the Admin Portal. Used by
 * the frontend to decide whether to let a custom role through `/admin`, so a
 * DIGITAL_MARKETER can reach the panel without being added to
 * `ADMIN_PORTAL_ROLES` in code.
 */
export const ADMIN_PORTAL_PERMISSIONS: Permission[] = PERMISSIONS.filter(
  (p) => p !== "orders.deliver" && p !== "refunds.request" && p !== "refunds.view"
);

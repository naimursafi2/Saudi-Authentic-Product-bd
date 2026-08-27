# Saudi Authentic Product

An e-commerce platform (Saudi/Madinah dates, gift boxes, and future categories)
with a customer storefront plus internal Admin / Co-Admin / Super Admin /
Order Manager / Employee / Delivery Agent portals. Currency is displayed in
**BDT** and shipping uses
**Bangladesh districts** — this is intentional (the storefront targets
Bangladesh), not a bug. Two independent apps, no shared code between them:

```
server/    Express 5 + TypeScript + Mongoose (MongoDB) REST API
client/    Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4
```

**Directory naming:** the two app folders on disk are `server/` and
`client/`. Much of the rest of this file (and `README.md`) still spells them
`backend/` and `frontend/` from an earlier layout — read those as `server/`
and `client/` respectively. Deployment targets Vercel (client) and Render
(server), which is why they sit on different origins; see the comment in
`client/src/proxy.ts` for what that implies for cookies.

Not a git repository at the time this file was first written; a `.git` now
exists at the root (see `git status` if unsure) — still be careful with
destructive file operations regardless.

## Architecture

### Backend (`backend/src`)

Layered, one pattern for every resource:

```
routes/<resource>.routes.ts       Express Router — auth/authorize/validate/upload wiring
controllers/<resource>.controller.ts   Thin, catchAsync-wrapped, calls service, calls sendSuccess
services/<resource>.service.ts    All business logic + Mongoose queries, throws ApiError
validators/<resource>.validator.ts  zod schemas (create/update/list-query), z.infer'd types
models/<Resource>.model.ts        Mongoose schema + interface
```

Register every new router in `routes/index.ts`.

#### Routes (mounted under `API_PREFIX`, default `/api/v1`)

| Base path | Purpose | Role restrictions (beyond `authenticate`) |
| --- | --- | --- |
| `/auth` | register/login/`google` (Continue with Google)/refresh/logout/logout-all, `GET /me`, change-password, forgot/reset-password, verify-email/resend-verification, plus 2FA (`POST /2fa/setup`, `/2fa/enable`, `/2fa/disable`, `/2fa/verify` — see "Security hardening" below). Login/register/google/refresh/forgot/reset/verify-email/resend-verification/`2fa/verify` are rate-limited via `authLimiter`. | mostly public; `/logout-all`, `/me`, `/change-password`, `/2fa/setup`, `/2fa/enable`, `/2fa/disable` require auth; `/2fa/verify` is public (it carries its own short-lived challenge token); `/google` 503s until `GOOGLE_CLIENT_ID` is configured |
| `/users` | customer's own profile (`PATCH /me` — name/phone), avatar (`PATCH`/`DELETE /me/avatar`, image upload via Cloudinary), address CRUD (`POST`/`PATCH`/`DELETE /me/addresses[/:addressId]`); staff creation/listing/role/status/staff-meta updates; `PATCH /:id/staff-meta/nid-image` (staff NID card photo upload); `PATCH /:id/unlock` (clear a failed-login lockout); `POST /:id/impersonate` (support-login) | create/role/status/staff-meta/nid-image/unlock: `admin`,`super_admin`; list/get: + `co_admin`; impersonate: `super_admin` only (and never onto another `super_admin`); all `/me/...` routes just require `authenticate` — scoped to the calling user via `req.user.id`, no role check needed; `createStaffSchema` allows creating `employee`,`delivery_agent`,`co_admin`,`order_manager`,`admin` (never `super_admin`) |
| `/categories` | public list/get by slug; create/update (image upload)/delete | create/update: `admin`,`super_admin`,`co_admin`; delete: `admin`,`super_admin` |
| `/products` | public list/get by slug; admin get-by-id; create/update (up to 6 images + JSON-encoded `categories`/`variants`/`highlights`/`existingImages`); delete | create/update/admin-get: `admin`,`super_admin`,`co_admin`; delete: `co_admin`,`super_admin` (`admin` excluded entirely). Content fields apply immediately and are audit-logged; the **stock** fields inside create/update are approval-gated for everyone but `super_admin` — see "Stock-change approval gate" below |
| `/orders` | customer creates/lists own (`/mine`); public `GET /track` (order number + email); staff lists all + updates status via the generic pipeline endpoint; delivery-agent self-scoped endpoints (`GET /assigned-to-me`, `PATCH /:id/delivery-status`, `POST /:id/send-delivery-otp`, `POST /:id/verify-otp`, `PATCH /:id/delivery-failed`); order-manager/co-admin `PATCH /:id/assign-agent`; `GET /:id` ownership/staff/assigned-agent-checked in controller | list-all/status-update/assign-agent: `admin`,`super_admin`,`co_admin`,`order_manager` (+`employee` for list only); delivery-agent-only endpoints: `delivery_agent` only, self-scoped; `/track` is public (mounted before the router's `authenticate`) — see "Order status pipeline & delivery" below |
| `/reviews` | public: recent reviews, reviews by product; customer creates one review per product; staff lists all/deletes | list-all/delete: `admin`,`super_admin`,`co_admin` |
| `/attendance` | self check-in/check-out/`mine`; staff: today summary, list all, update record | admin ops: `admin`,`super_admin`,`co_admin` |
| `/leaves` | employee creates/lists own/cancels; staff lists all + approves/rejects | review/list-all: `admin`,`super_admin`,`co_admin` |
| `/tasks` | employee lists own (`/mine`) + updates own status; staff creates/lists (filterable by `type`)/updates/deletes; every task has a required `type` (packing/product_counting/stock_checking/warehouse/customer_support/data_entry/product_preparation) for task-based access categorization | create/list/update: `admin`,`super_admin`,`co_admin`; delete: `admin`,`super_admin` |
| `/performance-reviews` | employee lists own reviews; staff creates/lists | create/list: `admin`,`super_admin`,`co_admin` |
| `/salary-payments` | employee lists own payment history; admin creates payment/lists all/updates status/sends notify email | `admin`,`super_admin` **only** — co_admin is deliberately excluded |
| `/inventory` | `GET /stock` (read-only live per-variant stock), low-stock list, logs, manual stock adjustment | `GET /stock`: + `employee`,`order_manager` (read-only — warehouse staff need the real count, not the ability to change it); low-stock/logs/adjust: `admin`,`super_admin`,`co_admin`. `POST /adjust` applies immediately **only** for `super_admin`; every other role gets `202 {pendingActionId}` and live stock is unchanged — see "Stock-change approval gate" below |
| `/reports` | any staff: `/employee-dashboard`; admin/co-admin: `/dashboard`, `/sales` | dashboard/sales: `admin`,`super_admin`,`co_admin` |
| `/hero-slides` | public list; create/update (image)/delete of homepage hero carousel slides | create/update: `admin`,`super_admin`,`co_admin`; delete: `admin`,`super_admin` |
| `/homepage-sections` | public list; create (promo banners, homepage carousel banners & product showcases only)/update/delete of homepage content sections | create/update: `admin`,`super_admin`,`co_admin`; delete: `admin`,`super_admin` |
| `/site-settings` | public `GET /` (singleton); `PATCH /` (logo upload) for site name/announcement strip (`announcementEnabled` + `announcementText`)/contact/footer; `PATCH /logo` (logo only) | `PATCH /`: `admin`,`super_admin` only — `co_admin` is **not** able to reach the full settings update (unlike `/hero-slides` and `/homepage-sections`, whose create/update do allow `co_admin`); `PATCH /logo`: also `co_admin` via the narrower `content.branding.manage` permission — see "Storefront header" below |
| `/coupons` | `POST /validate` (authenticated customer, preview a discount); `GET /`, `POST /`, `PATCH /:id` (create/update — may be gated through the approval system, see "Approval-gate system" below); `DELETE /:id` | list/create/update: `co_admin`,`admin`,`super_admin`; delete: `admin`,`super_admin` only; `/validate` just requires `authenticate` |
| `/nav-links` | public list (sorted, visible-only by default); admin create/update/delete of the storefront header's top-level nav links | create/update/delete: `admin`,`super_admin` only |
| `/footer-columns` | public list (sorted, visible-only by default); admin create/update/delete of the storefront footer's link columns (each with an embedded, wholesale-replaced `links[]`) | create/update/delete: `admin`,`super_admin` only |
| `/static-pages` | public list + `GET /:type` (lazily-seeded singleton per fixed page type); admin `PATCH /:type` (hero image upload) | update: `admin`,`super_admin` only |
| `/audit-logs` | `GET /` — read-only, general-purpose sensitive-action audit trail | `co_admin`,`order_manager`,`employee`,`delivery_agent`,`admin`,`super_admin` may call it, but every non-admin/super_admin viewer is force-scoped server-side to their own actions only — see "Approval-gate system & audit logging" below |
| `/pending-actions` | `GET /`, `PATCH /:id/grant`, `PATCH /:id/deny` — the Grant-Based Approval Workflow queue | `super_admin` only |
| `/approval-settings` | `GET /`, `PATCH /` (singleton) — the Super-Admin-editable numeric thresholds the approval gate checks against | `super_admin` only |
| `/investments` | `GET /` (list), `POST /` (create) — append-only partner investment ledger, no update/delete route | list: `admin`,`super_admin`; create: `super_admin` only |
| `/expenses` | `GET /`, `POST /`, `PATCH /:id/confirm`, `PATCH /:id/reject` | list/create: `co_admin`,`admin`,`super_admin` (co_admin scoped to own submissions); confirm/reject: `admin`,`super_admin` only |
| `/refunds` | `GET /`, `POST /`, `PATCH /:id/review`, `PATCH /:id/reject`, `PATCH /:id/approve` | create: `customer`,`order_manager`,`co_admin`,`admin`,`super_admin` (`co_admin`'s request is gated, see below); list: `customer`,`order_manager`,`co_admin`,`admin`,`super_admin` — a `customer` viewer is force-scoped server-side to their own refunds (same pattern as `co_admin`'s own-submissions scoping), which is what powers the account portal's per-order refund status; review/reject: `order_manager`,`admin`,`super_admin`; approve: `admin`,`super_admin` |
| `/finance` | `GET /summary` — combined revenue/investment/expense/profit-loss snapshot | `finance.view` (`admin`,`super_admin` by default) — `co_admin` finance visibility is off by default per the spec |
| `/shops` | `GET /` (scoped list), `POST /`, `PATCH /:id`, `DELETE /:id`, plus `GET /users/:userId` and `PATCH /users/:userId` (a staff member's shop assignment) | list: `shops.view`; create/update/delete/assign: `shops.manage` (`admin`,`super_admin` by default). A caller without `shops.manage` only ever sees the shops in their own `User.assignedShops` — see "Purchasing: shops, batches & flexible landed costs" below |
| `/purchases` | `GET /`, `GET /:id`, `POST /` (multipart), `PATCH /:id`, `PATCH /:id/receive`, `PATCH /:id/cancel`, `DELETE /:id`, the cost-item endpoints `POST /:id/costs` / `PATCH /:id/costs/:costId` / `DELETE /:id/costs/:costId`, and `GET /product/:productId` (per-product landed-cost history) | view: `purchases.view`; create: `purchases.create`; edit/costs/receive/cancel: `purchases.edit`; delete: `purchases.delete` (`co_admin` deliberately lacks it). Every read and write is additionally shop-scoped |
| `/roles` | `GET /permissions` (the permission catalogue, grouped + labelled), `GET /` (all roles with assigned-user counts), `POST /`, `PATCH /:id`, `DELETE /:id`, plus `GET /users/:userId` (one user's effective permissions) and `PATCH /users/:userId` (assign/clear a custom role) | read: `roles.view`; author roles: `roles.manage`; assign a role to a person: `employees.manage` — see "Roles & permissions" below for the guards the service adds on top |

**Coupons** (`models/Coupon.model.ts`, `services/coupon.service.ts`,
`validators/coupon.validator.ts`): `code` (unique, uppercased), `discountType`
(`"percentage"` capped at 100, or `"fixed"` BDT), `minOrderAmountBDT`,
`startsAt`/`expiresAt`, an optional `usageLimit`, and `usageCount`. A
coupon's `status` (`scheduled`/`active`/`expired`/`disabled`) is **derived**
on every read (`computeCouponStatus()`), not stored, so it's never stale —
`isActive: false` means `disabled` regardless of dates; otherwise it's
`scheduled` before `startsAt`, `expired` after `expiresAt`, else `active`.
`POST /coupons/validate` (any authenticated customer) is a **preview only**
— it never mutates `usageCount`. The discount that actually gets charged is
always recomputed from scratch inside `order.service.ts#createOrder` (via
the same `validateCouponForOrder()` the preview endpoint uses), keyed off
the order's own server-computed `subtotalBDT` — a client-submitted discount
amount is never trusted, only the coupon *code* string
(`createOrderSchema`'s optional `couponCode`). If validation fails at
order-creation time (expired/disabled/exhausted/unknown/below minimum),
`createOrder` throws before the order document is created, so nothing is
charged and no stock is touched. On success, `Order.couponCode`/
`discountBDT` are stored on the order and `applyCouponUsage()` atomically
increments `usageCount` — guarded with `usageCount: { $lt: usageLimit }` in
the update filter so two concurrent orders can't both redeem the last use of
a limited coupon. Frontend: `CheckoutClient.tsx` has a coupon-code field in
the order summary (`lib/api/coupons.ts#validateCoupon`) showing a live
discount preview and updated total before submit; `/admin/coupons` is full
CRUD (list/create/edit/delete), reachable by `co_admin`/`admin`/`super_admin`
(deletion stays `admin`/`super_admin` only) — **large-discount creates/
updates are gated through the approval system** (see "Approval-gate system &
audit logging" below): `co_admin`/`admin` create/update a **percentage**
coupon directly only at/below `ApprovalSettings.couponAutoApprovePercent`
(default 10%); above that and up to `couponSuperAdminOnlyAbovePercent`
(default 25%) the request is submitted for Super Admin grant instead of
taking effect immediately (`POST`/`PATCH` respond `202` with a
`pendingActionId`, not the coupon); above the Super-Admin-only threshold
`co_admin`/`admin` are rejected outright (`403`). `super_admin` always
creates/updates directly, any discount size. Fixed-amount (non-percentage)
coupons aren't gated by this — the spec only defines thresholds for
percentage discounts.

**Public order tracking** (`GET /orders/track?orderNumber=...&email=...`,
`order.service.ts#trackOrder`): unauthenticated customers look up an order by
its human-readable `orderNumber` (e.g. `SAP-20260816-1234`) plus the email
used at checkout — both must match or the endpoint 404s with a generic "no
order found" message, so a guessed/leaked order number alone can't be used
to pull up someone else's order. Powers the storefront's `/track-order` page
(`frontend/src/app/(site)/track-order/page.tsx`); it is the only unauthenticated
route under `/orders` (mounted before the router's `router.use(authenticate)`).

**Order status pipeline & delivery** (`constants/orderStatus.ts`,
`services/order.service.ts`, `models/Order.model.ts`): `Order.status` is a
14-value pipeline — `pending → confirmed → processing → packed →
ready_for_dispatch → assigned_to_agent → picked_up → out_for_delivery →
otp_verified → delivered`, plus the branch statuses `delivery_failed`,
`cancelled`, `returned`, `refunded`. `ORDER_TRANSITIONS` is an explicit
adjacency map (which statuses a given status may move to) enforced in
`order.service.ts#updateOrderStatus` — a request naming an invalid next
status 400s regardless of role. `DELIVERY_ONLY_STATUSES` (everything from
`assigned_to_agent` through `delivered`, plus `delivery_failed`) can only be
reached through their own dedicated endpoints below, never the generic
`PATCH /orders/:id/status`. Non-`admin`/`super_admin` actors are further
gated by `GENERIC_STATUS_ACTOR_ROLES` (keyed by the order's *current*
status) — `order_manager`/`co_admin` drive every pre-dispatch step plus
cancelling/returning; `returned → refunded` is **`admin`/`super_admin`
only** (refunds are financial, deliberately excluded from Order Manager's
responsibilities, mirroring the Salary-payments restriction pattern).
`admin`/`super_admin` always bypass the actor-role check but never the
adjacency table. Every `statusHistory` entry now records `changedBy`,
`changedByRole`, and `previousStatus` alongside `status`/`at`/`note`,
satisfying a full per-change audit trail.

Dedicated endpoints beyond the generic one: `PATCH /orders/:id/assign-agent`
(`order_manager`/`co_admin`/`admin`/`super_admin`; validates the target user
has role `delivery_agent` and is active, and that the order is currently
`ready_for_dispatch` or `delivery_failed`) sets `Order.assignedAgent` and
transitions to `assigned_to_agent`. `PATCH /orders/:id/delivery-status`
(`delivery_agent` only, self-scoped to `order.assignedAgent === req.user.id`)
handles `picked_up` and `out_for_delivery` — this is a pure dispatch signal
now and no longer generates or sends an OTP itself.

**Delivery OTP verification** (`order.service.ts#sendDeliveryOtp`/
`verifyDeliveryOtp`, `constants/security.ts`): sending the code is its own
explicit step, separate from the dispatch transition, matching the real
courier flow of confirming receipt only once the agent has actually reached
the customer. `POST /orders/:id/send-delivery-otp` (`delivery_agent` only,
self-scoped, requires `status === "out_for_delivery"`) generates a random
**4-digit** `otpCode` (`select: false` on the schema, plus a `toJSON`
transform that always strips it — defense in depth), a
`DELIVERY_OTP_TTL_MINUTES`-minute (5) `otpExpiresAt`, resets `otpAttempts` to
0, and fire-and-forget dispatches it to the customer via both
`sendDeliveryOtpEmail` (`email.service.ts`) and `sendSms` (`config/sms.ts`).
Calling it again while still `out_for_delivery` fully replaces the code and
resets the attempt counter ("Resend OTP" in the delivery UI) — it does not
touch `statusHistory`, since no status changes. Since no SMS gateway is
actually wired up yet (see "No SMS gateway" below), the OTP is also surfaced
directly to the order owner — `order.controller.ts`'s `getOrder`/`trackOrder`
add a top-level `otp` field to the response, but **only** when the requester
is confirmed to be the order's owner and `status === "out_for_delivery"`;
staff and the delivery agent's own endpoints never select or expose
`otpCode` at all, so the agent must obtain the code verbally from the
customer (real-world courier UX) until a real SMS provider is connected.

`POST /orders/:id/verify-otp` requires a live, unexpired `otpCode` (400s
with a clear "send a new delivery OTP" message if none is outstanding or it
expired) and enforces `MAX_DELIVERY_OTP_ATTEMPTS` (5): each wrong code
increments `Order.otpAttempts` and 400s with the remaining-attempts count;
the attempt that reaches the limit invalidates the code outright (cleared,
forcing a fresh send) rather than leaving it guessable indefinitely — a
delivery agent has no way to mark an order `delivered` other than through
this endpoint succeeding, since `delivered` is a `DELIVERY_ONLY_STATUS` the
generic `PATCH /orders/:id/status` endpoint can never reach and
`delivery_agent` isn't even authorized on that route. On success it records
both `otp_verified` and `delivered` in the same call, sets the durable
`deliveryVerified: true`/`deliveredAt`/`deliveredBy` fields (the only place
they're ever set — a query-friendly record alongside the same facts already
in `statusHistory`'s `delivered` entry), clears the OTP fields and resets
`otpAttempts` to 0, and — for `cod` orders — sets `isPaid = true`. `PATCH
/orders/:id/delivery-failed` requires a `failureReason`, records
`delivery_failed`, and also clears any outstanding OTP/attempts.
`restockOrderItems()` (shared helper) restocks and writes an `InventoryLog`
entry (`reason: "order_cancelled"` or the new `"order_returned"`) for both
`cancelled` and `returned` transitions.

Frontend: the enum/transition table is mirrored in
`frontend/src/lib/orderStatus.ts` (`ORDER_TRANSITIONS`,
`nextGenericStatuses()` — filters out delivery-only targets so
`/admin/orders`'s status dropdown only ever offers valid, non-agent moves).
`/admin/orders`'s order-detail modal shows an "Assign Delivery Agent" picker
(populated via the existing `listUsers({role: "delivery_agent"})` API, no
new endpoint needed) when the order is `ready_for_dispatch`/`delivery_failed`.
The shared `frontend/src/components/account/OrderStatusTimeline.tsx`
component (a 10-step visual stepper, with `cancelled`/`delivery_failed`/
`returned`/`refunded` rendered as a banner instead of a step) is used by
both the public `/track-order` page and the customer account portal's Order
History — one timeline implementation, not two. `/track-order` also
displays the owner-visible `otp` field when present, with a "share this
code with the delivery agent" prompt.

**Delivery Portal** (`frontend/src/app/delivery`, `delivery_agent` only,
modeled directly on the Employee Portal's shell): `/delivery` (dashboard —
counts of assigned orders by status), `/delivery/orders` (assigned-orders
list + a detail modal with Picked-Up/Out-for-Delivery buttons; once
`out_for_delivery`, a **Send Delivery OTP** button, then — once a code is
outstanding (`order.otpExpiresAt` present) — an OTP-entry field, a **Verify
& Confirm Delivery** button, a **Resend OTP** link, and a Delivery-Failed
form), `/delivery/profile` (avatar/address,
reusing the same `ProfileSection`/`AddressBook` components as everywhere
else). `RoleGuard allowed={["delivery_agent"]}` in `app/delivery/layout.tsx`
is the only role that can reach it; it is structurally excluded from
`/admin` (not in `ADMIN_PORTAL_ROLES`), not just nav-hidden.

**Order Manager** reuses the existing `/admin` shell rather than a separate
portal — `ADMIN_PORTAL_ROLES` includes `order_manager`, and
`AdminNav.tsx`'s nav items are explicitly `roles`-restricted so an Order
Manager only ever sees Dashboard, Orders, Refunds, and Audit Logs (their own
actions) — the real boundary is still backend `authorize()`, not nav
visibility.

#### Roles & permissions

Authorization is **role + permission** based. Routes ask what a caller may
*do*, not who they *are*, so a new kind of staff member can be onboarded from
the admin panel with no code change — which is the whole point.

**This replaced the previous "hand-list roles on every route" arrangement
without changing any role's actual access.** The seven built-in roles are
seeded as `Role` documents whose permission lists
(`ROLE_DEFAULT_PERMISSIONS` in `constants/permissions.ts`) were transcribed
field-by-field from the `authorize(...)` calls they replaced. Every
pre-existing integration test passes untouched, which is the evidence that
the transcription is faithful — including the deliberate asymmetries, e.g.
Co-Admin holds `products.delete` and Admin does not.

- **`constants/permissions.ts`** — `PERMISSIONS` (the flat catalogue),
  `PERMISSION_GROUPS` (labels + grouping for the panel's checkbox list),
  `SENSITIVE_PERMISSIONS` (the four that confer authority over staff or the
  permission system itself), and `ROLE_DEFAULT_PERMISSIONS`. `super_admin` is
  deliberately absent from that map: it is special-cased to hold every
  permission and its role document cannot be edited, so a bad edit can never
  lock every human out of the panel.
- **`models/Role.model.ts`** — `{key, name, description, permissions[],
  isSystem, isActive}`. System roles (`isSystem: true`) have a `key` matching
  `User.role` exactly, which is what makes every existing account work
  unchanged; they can be re-permissioned but never renamed or deleted. Custom
  roles (VIDEO_EDITOR, DIGITAL_MARKETER, …) are freely creatable.
- **`User.customRole`** — an optional ref to a custom role. It **adds**
  permissions on top of the user's built-in `role` and never removes them, so
  assigning one can't silently demote an account, and `role` stays the single
  source of role identity for every legacy check.
- **`services/role.service.ts#resolvePermissions`** — base role's set ∪ custom
  role's set, with an in-process `Map` cache so resolving on every
  authenticated request doesn't cost a query. The cache is invalidated on
  every role write, so an edit takes effect on the caller's **next request**
  with no re-login. `ensureSystemRoles()` seeds the built-ins lazily (same
  pattern as `SiteSettings`) and only ever creates, so an admin's edits
  survive a restart.
- **`middlewares/rbac.middleware.ts#requirePermission(...)`** — the gate.
  Passes when the caller holds ANY of the listed permissions;
  `requireAllPermissions(...)` demands all. `authenticate` resolves
  `req.user.permissions` before it runs.

**Escalation guards live in the service, not the route** — a permission check
alone can't express them:

- You may only grant permissions you hold yourself. Without this, an Admin
  with `roles.manage` could mint a role carrying `approvals.manage` (Super
  Admin only) and assign it to themselves. Applies to creating a role,
  editing one, and assigning one to a user.
- Only a Super Admin may re-permission a **built-in** role — otherwise an
  Admin would simply widen their own role instead.
- The `SUPER_ADMIN` role can't be edited by anyone, built-in roles can't be
  deleted, and a custom role still assigned to users can't be deleted until
  they're reassigned.
- Every create/update/delete/assignment is written to `AuditLog`.

`authorize(...)` and `authorizeSelfOrRoles(...)` still exist and are still
used where the check genuinely is about role identity (self-scoped
ownership). Everything with a capability behind it uses `requirePermission`.

Frontend: `lib/permissions.ts` mirrors the catalogue (manually kept in sync,
same arrangement as `lib/roles.ts`); `AuthContext` exposes `permissions` and
`hasPermission(...)` from `GET /auth/me`; `AdminNav` filters every item by
permission rather than role, so a custom role gets a correct menu with no
code change; `RoleGuard` admits a user by built-in role **or** by holding any
admin-panel permission, which is how a DIGITAL_MARKETER reaches `/admin`
without being added to `ADMIN_PORTAL_ROLES`; and the page-level "Access
restricted" guards on `/admin/salary`, `/admin/finance`, `/admin/settings`
and friends now key off the permission the backing API requires instead of
`user.role === "co_admin"`. `/admin/roles` is the management UI (custom and
built-in roles listed separately, grouped permission checkboxes, permissions
the actor can't grant rendered disabled rather than hidden), and
`/admin/employees` gains an **Access** action per staff member showing their
effective permission list and letting an authorised user assign or clear a
custom role.

**None of the frontend work is a security boundary.** It hides menu items and
pages the user can't use; the API re-checks every permission on every
request, so a tampered client gains a visible link and a 403.

#### Approval-gate system & audit logging (Grant-Based Approval Workflow)

Implements ROLES_AND_PERMISSIONS_v2.md §14/§19–20 — a single reusable
`pending_actions` table (not a bespoke approval flow per feature) plus a
general-purpose audit log covering sensitive actions that aren't already
covered by `InventoryLog` (stock deltas) or `Order.statusHistory` (order
status changes).

**`PendingAction`** (`models/PendingAction.model.ts`,
`services/pendingAction.service.ts`): `actionType` (one of
`coupon.create`/`coupon.update`/`product.create`/`product.delete`/
`product.stock.update`/`inventory.adjust`/`refund.request`/
`refund.approve`/`expense.confirm`/`purchase.receive`), `payload` (the
intended change, applied **verbatim** on grant — a Super Admin can never
silently edit what was requested, only approve or deny it), `requestedBy`/
`requestedByRole`, `status` (`pending`/`granted`/`denied`), `reviewedBy`/
`reviewedAt`/`reviewNote`. Creating one (`createPendingAction()`) fires a
fire-and-forget email (`sendPendingActionRequestedEmail`) to every active
`super_admin`; granting/denying (`grantPendingAction()`/
`denyPendingAction()`, both `super_admin`-only via `PATCH
/pending-actions/:id/grant`|`/deny`) emails the original requester the
outcome. Each gated action type registers its own "apply" function via
`registerPendingActionHandler(actionType, handler)` at the bottom of its
owning service (`coupon.service.ts`, `product.service.ts`,
`inventory.service.ts`, `refund.service.ts`, `expense.service.ts`,
`purchase.service.ts`) rather than `pendingAction.service.ts` importing
those services directly — the services import *this* module to request a
grant, so the reverse import would be circular; since every route file (and
therefore every service) is imported by `routes/index.ts` at server
startup, all handlers are registered before any request is handled. An
action type whose payload already had a side effect before review — only
`product.create`, which uploads its images to Cloudinary up front so the
Super Admin's review shows the real photos — may also register a cleanup
function via `registerPendingActionDenyHandler(actionType, handler)`, run
on denial to undo that side effect (deletes the uploaded images); most
action types don't need one, since their payload is otherwise inert until
granted. `/admin/approvals` (super_admin only) is the review queue
(grant/deny with an optional note) plus a form for the thresholds below.

**`ApprovalSettings`** (`models/ApprovalSettings.model.ts`,
`services/approvalSettings.service.ts`): singleton (same lazily-created
pattern as `SiteSettings`), `super_admin`-only `GET`/`PATCH
/approval-settings` — `couponAutoApprovePercent` (default 10),
`couponSuperAdminOnlyAbovePercent` (default 25), `refundAutoApproveThresholdBDT`
(default 5000), `expenseApprovalThresholdBDT` (default 2000). These numbers
are checked live by `coupon.service.ts`, `expense.service.ts`, and
`refund.service.ts` — never hardcoded, per the spec's explicit requirement.

**Product creation approval gate** (`product.service.ts#createProduct`):
**only `super_admin` publishes a new product directly. Every other role
that can create a product — `admin` and `co_admin` alike — has the entire
submission (content, images and requested stock together) queued as a
`product.create` pending action, and no `Product` document exists at all
until a Super Admin grants it.** `POST /products` responds `202
{pendingActionId}` for a gated caller, with no `product` in the body — the
frontend shows a "submitted for Super Admin approval" notice rather than
the created record. Images are uploaded to Cloudinary up front (so the
review shows the real photos and validation still happens immediately) and
recorded in the payload; the grant handler re-validates the slug and
categories are still available (a slug can be taken, or a category deleted,
while the request sat in the queue) before creating the product, and audits
the creation with a `note: "Applied via approval grant"`. A denied request's
uploaded images are cleaned up via the deny-handler mechanism above rather
than left orphaned in Cloudinary. This supersedes the narrower stock-only
gating a new product used to get — the whole product goes live in one step
alongside its stock, not separately. `/admin/approvals` renders it like any
other pending action (`ACTION_LABELS`/`PayloadSummary` in
`app/admin/approvals/page.tsx` know its payload shape), so there's no
separate "product requests" page — the existing generic review queue,
filterable by status, is where a Super Admin sees and grants/denies these.

**Product deletion** (`product.service.ts#deleteProduct`): `super_admin`
deletes directly; `co_admin` may only *request* deletion — `DELETE
/products/:id` responds `202` with a `pendingActionId` instead of deleting,
and the product is only removed once a Super Admin grants it;
**`admin` has no product-deletion access at all** (excluded from the
route's `authorize()` entirely) — a deliberate reduction from Admin's
otherwise-broad product control, per the spec. `/admin/products`'s delete
button reflects this: hidden for `admin`, a "Request deletion" action for
`co_admin`, a normal "Delete" action for `super_admin`.

**Stock-change approval gate** — **only `super_admin` changes stock
directly. Every other role, `admin` included, has its stock change parked in
the approval queue while the live count stays exactly as it was.** This is
stricter than the discount/refund gates (which have thresholds); there is no
threshold here, any stock change by a non-Super-Admin is gated. Two entry
points funnel into two action types:

- `inventory.adjust` — `POST /inventory/adjust` (the manual delta correction
  on `/admin/inventory`). Responds `202 {pendingActionId}`. The payload holds
  the **delta, not a target number**, and `applyStockDelta` re-evaluates it
  against whatever stock is current *at grant time* — so units sold while the
  request waited are still accounted for. `adjustStock()` pre-validates that
  the delta wouldn't go negative before queuing, so an obviously-invalid
  request fails fast rather than at grant time.
- `product.stock.update` — the stock fields inside `PATCH /products/:id`
  (an *existing* product's edit; a brand-new product is gated wholesale by
  `product.create` instead — see "Product creation approval gate" above,
  which supersedes this entry point for a product that doesn't exist yet).
  The product form submits content and stock together, so `updateProduct`
  **splits them**: the live stock is carried over onto the incoming variants
  (matched by variant id, falling back to array position — see "Variant
  identity across edits" below) and applies
  untouched, while the submitted quantities go to the queue. One submit can
  therefore ship a description edit instantly and hold its stock change —
  the response carries `stockPendingActionId` when that happened, which
  `/admin/products` surfaces as a notice. No pending action is created when
  the submitted stock matches what's already stored, so a plain
  title/description edit never produces an empty approval request.

Both handlers are registered at the bottom of `inventory.service.ts` (not
`product.service.ts`) so all stock writing lives in one module;
`product.service.ts` calls `requestVariantStockUpdate()` to express the
intent. Approval gates **when** a change goes live — it does not replace the
`InventoryLog` history, which is still written at the moment the change
actually applies, with the same who/delta/balance-after/timestamp fields as
an ungated change. Automatic stock movement (order placed, cancelled,
returned) is **never** gated — it's system-driven, not someone editing a
number.

**Variant identity across edits**: the admin product form round-trips each
existing variant's `id` (`ProductFormVariant.id` ← `ApiProduct.variants[]._id`),
and `updateProduct` reuses that `_id` when rebuilding the variants array.
Without this, the wholesale replacement minted a fresh `_id` on every save,
orphaning the `variantId` already stored on cart lines and order items — an
unrelated description edit could silently break existing carts. Two separate
matching rules, deliberately: **identity** is matched strictly (only an id
that genuinely belongs to *this* product preserves the `_id`; a foreign or
stale id makes it a new variant, so an id can't be grafted in from another
product), while **stock carry-over** falls back to array position when no
match is found — so a caller that doesn't round-trip ids at all (an older
client, a direct API call) can never silently zero out a variant's stock.
Because ids are now stable, a queued `product.stock.update` still resolves to
the right variant after later edits; `setVariantStock()` keeps its label
fallback as a second line of defence.

**Overlapping stock requests**: `listPendingActions()` annotates every
returned action with `conflictingActionIds` — the other **still-pending**
stock requests writing to a variant this one also touches
(`stockTargetVariantIds()` extracts targets from both stock action types).
It's computed across the whole queue, not just the page being viewed, so
pagination can't hide a conflict, and it's symmetric (each side lists the
other). `/admin/approvals` renders it as a "Conflicts with N" badge and the
Grant button raises an extra confirm explaining that granting one leaves the
others pending to apply on top. Granting a conflicted request also records
the overlap in its audit-log entry (`conflictingActionIds` in `newValue`
plus a human-readable `note`), leaving a permanent trace that the grant
raced another request. Nothing blocks the grant — see Known limitations.

Stock has exactly one source of truth, `Product.variants[].stock`; there is
no denormalized copy anywhere, and `lib/api/client.ts` sets `cache:
"no-store"` on every request, so the storefront, listings, admin portal and
the Employee portal's read-only `/employee/stock` view (backed by `GET
/inventory/stock`, the one inventory route `employee`/`order_manager` can
reach) all show the same live number without any cache-invalidation step.
Zero stock renders as a **"Stock Out" badge** rather than a `0`, and
disables ordering — see `lib/stock.ts` (`totalStock`, `isStockOut`,
`firstAvailableVariant`) for the shared helpers `ProductCard` and
`ProductInfo` use.

**Product content edits are logged, never gated** — per the spec, `admin`
and `co_admin` edit a product's title/description (and the other fields in
`AUDITED_PRODUCT_FIELDS`: slug, tagline, origin, badge, storage
instructions, best-seller/featured flags) **directly and immediately**, with
no approval step. Each such edit writes one `AuditLog` entry recording the
actor and role, the changed fields' old and new values, and the timestamp,
with a `note` naming exactly which fields moved. `diffProductFields()`
compares before/after so unchanged fields are excluded and a submit that
changes nothing writes no entry at all. Visible to Super Admin at
`/admin/audit-logs`.

**`AuditLog`** (`models/AuditLog.model.ts`, `services/auditLog.service.ts`):
append-only, `{actor, actorRole, action, resource, resourceId?, oldValue?,
newValue?, note?, createdAt}` — `action`/`resource` are free-form
dot-namespaced strings (e.g. `"coupon.create"`, `"user.role.update"`) rather
than a closed enum. `recordAuditLog()` never throws (catches internally,
logs to console on failure) so a logging failure never breaks the action it
describes — called from `user.service.ts` (role/status changes),
`coupon.service.ts`, `product.service.ts`, `approvalSettings.service.ts`,
`pendingAction.service.ts` (every grant/deny), and the Finance services
below. `GET /audit-logs` is read-only for every role; `super_admin`/`admin`
see everything, every other viewer (`co_admin`, `order_manager`, `employee`,
`delivery_agent`) is **force-scoped server-side** to their own actions only,
regardless of any filter they pass — `/admin/audit-logs` is the read-only
list view (reachable by every admin-portal role plus `order_manager`).

Several `recordAuditLog()` call sites additionally stash a human name in
`newValue` purely so the admin UI can display one — `user.service.ts`'s
role/status/unlock/impersonate calls include `name`/`targetEmail` for the
target account (the acting function already has that user document loaded,
so this costs no extra query), and `role.service.ts#assignCustomRole` /
`shop.service.ts` similarly include the affected user's `name`. This is
presentation-only data, not a new source of truth — the record's real state
still lives on the `User`/`Role`/`Shop` documents themselves.
`pendingAction.service.ts`'s grant/deny entries include a best-effort `name`
pulled from the pending action's own `payload` (most payloads already carry
`name`/`productName`/`code`) plus, on grant, the underlying `resource` type
returned by the action's apply-handler — both exist so `/admin/audit-logs`
never has to show a bare "PendingAction" row. The stock-conflict grant note
was also reworded to drop the raw conflicting-action ids from the sentence
itself (`"N other pending request(s) still target the same variant."`) —
the ids remain fully available in `newValue.conflictingActionIds` for
anyone who needs to trace them, they're just not inlined into the
human-readable note anymore.

**`/admin/audit-logs`** (`app/admin/audit-logs/page.tsx`) translates every
raw `action`/`resource` value before display — never render `log.action`
or `log.resource` directly, and don't reintroduce a "PendingAction #764b74"
resource cell or a mongo id in the Note column. Two explicit dictionaries
do the translation: `DIRECT_ACTION_LABELS` for the ~35 literal actions
listed above, and `GATED_ACTION_LABELS` for the nine `PendingActionType`s
crossed with their `.request`/`.grant`/`.deny` suffix (`splitGatedAction()`
detects the suffix; each of the 9×3 combinations is spelled out by hand
rather than composed, since e.g. "Refund Requested" — the direct action —
and "Refund Request Submitted" — the gated one — need to read differently
even though they share a verb) — anything genuinely unmapped falls back to
a humanized version of the raw string rather than failing silently.
`actionTone()` colors the action badge by suffix first (`.grant` → success/
green, `.deny` → danger/red, `.request` → pending/gold) and by keyword
second for direct actions (delete/reject/cancel → red, approve/confirm/
unlock → green, create/update/assign → blue, else neutral) — reusing the
same `success-soft`/`danger-soft`/`gold-soft`/`info-soft` tokens as
`StatusBadge.tsx` and the CRUD action chips above, not new colors.
`resourceLabel()` pulls a display name from `newValue`/`oldValue` (`name`/
`productName`/`code`/`roleName`, whichever is present) and re-labels a
`PendingAction` resource to what it actually affected; the raw
`resourceId` still renders, but only as a small muted `#a1b2c3` (last 6
characters, full id in the `title` tooltip) beside the friendly name, never
as the cell's headline — satisfying "available for debugging, not
prominent" without deleting the id outright. `friendlyNote()` shows the
backend's own `note` when present, and only synthesizes a sentence itself
for the handful of actions that usually don't carry one (`user.role.update`,
`user.status.update`, `user.impersonate.start`, and a generic sentence for
any `.request`/`.grant`/`.deny` row that came through with no reviewer note).

#### Models (`src/models`)

`User` (bcrypt password, `role` enum — `customer`,`employee`,`delivery_agent`,`co_admin`,`order_manager`,`admin`,`super_admin` — `tokenVersion` for logout-all/invalidation, embedded `addresses[]`, optional `staffMeta`, plus the security fields `failedLoginAttempts`/`lockedUntil`/`lastSeenAt`/`twoFactorEnabled`/`twoFactorSecret`/`twoFactorPendingSecret`/`twoFactorRecoveryCodes` — see "Security hardening" below), `Category`, `Product` (embedded `variants[]` with per-variant price/stock/SKU, auto-derived `minPriceBDT`, text-indexed), `Order` (embedded item/shipping snapshots, `statusHistory[]` with actor/role per entry, optional `couponCode`/`discountBDT`, `assignedAgent`/OTP fields/`deliveryNotes`/`failureReason` — see "Order status pipeline & delivery" below), `Coupon` (code, discount type/value, order window, optional usage limit — see "Coupons" below), `Review` (one per customer per product), `Attendance`, `LeaveRequest`, `Task` (required `type` field categorizing task-based access — see "Order status pipeline & delivery" below for the sibling roles this supports), `PerformanceReview`, `SalaryPayment`, `InventoryLog` (audit trail for stock changes — order placed/cancelled/returned/manual adjustment), `HeroSlide`, `HomepageSection` (see "Homepage content management" below), `SiteSettings` (singleton — site name/logo/announcement/contact/footer tagline, plus an embedded `socialLinks[]` of `{platform, url}`, `platform` one of a fixed enum), `NavLink`, `FooterColumn` (see "Navigation & footer content management" below), `StaticPage` (see "Static page content management" below), `Role` (a named permission bundle — the seven built-ins plus any custom roles, see "Roles & permissions" above), `PendingAction`/`ApprovalSettings` (see "Approval-gate system & audit logging" above), `AuditLog` (general sensitive-action trail, see above), `Investment`/`Expense`/`Refund` (see "Finance module" below), `Shop`/`Purchase` (see "Purchasing: shops, batches & flexible landed costs" below).

#### Finance module (Investment, Expense, Refund, Profit/Loss)

Implements ROLES_AND_PERMISSIONS_v2.md §6/§10/§11. "Revenue" is
**deliberately not re-derived as its own model** — `report.service.ts#getSalesSummary`
already computes `totalRevenueBDT` from live `Order` data, and
`finance.service.ts#getFinanceSummary` (`GET /finance/summary`,
`admin`/`super_admin` only — `co_admin` finance visibility is off by default)
calls into it directly rather than duplicating the aggregation.
"Profit/Loss" is likewise computed, not stored: `netProfitBDT =
totalRevenueBDT - totalExpensesBDT` (confirmed expenses only), plus a
`cashBalanceBDT = totalInvestmentBDT + totalRevenueBDT - totalExpensesBDT`.
`/admin/finance` renders this as a dashboard with an expenses-by-category
breakdown.

- **`Investment`** (`models/Investment.model.ts`,
  `services/investment.service.ts`) — the Partner Investment Ledger:
  `investorName`, `amountBDT`, `investedAt`, `note`, `recordedBy`. **Append-only
  — there is deliberately no update/delete route**; a correction is a new
  entry, never an edit, per the spec. `super_admin` creates
  (`/admin/investments`); `admin` can view the list but not add.
- **`Expense`** (`models/Expense.model.ts`, `services/expense.service.ts`) —
  `category` (one of `product_purchase`/`packaging`/`delivery`/`shipping`/
  `marketing`/`advertising`/`warehouse`/`salaries`/`software`/
  `payment_fees`/`refund`/`other`), `amountBDT`, `incurredAt`, `status`
  (`pending`/`confirmed`/`rejected`). `admin`/`super_admin` entries are
  auto-confirmed; `co_admin` entries always start `pending` and need
  `PATCH /expenses/:id/confirm`|`/reject` from an `admin`/`super_admin` —
  and if the amount exceeds `ApprovalSettings.expenseApprovalThresholdBDT`,
  a `pending_action` (`expense.confirm`) is *also* created so only a
  `super_admin` grant (not a direct `admin` confirm) can confirm it — the
  direct-confirm endpoint itself enforces this (`confirmExpense()` 403s an
  `admin` attempting to confirm an over-threshold expense outside the grant
  flow). Confirmed expenses are immutable — no edit/delete route exists once
  `status: "confirmed"`. `/admin/expenses`.
- **`Refund`** (`models/Refund.model.ts`, `services/refund.service.ts`) —
  the Refund & Return Workflow: `reasonCategory`
  (`damaged`/`wrong_item`/`not_as_described`/`changed_mind`/`other`),
  `requestedAmountBDT`, `status`
  (`pending_review`→`pending_approval`→`approved`/`rejected`). A refund can
  only be requested on an order whose `Order.status` is already `"returned"`
  (reusing the existing order pipeline's `returned` state, see "Order status
  pipeline & delivery" above) — `POST /refunds` (customer on their own
  order, or `order_manager`/`co_admin`/`admin`/`super_admin` on any order;
  **a `co_admin`'s request always requires a Super Admin grant** — routed
  through `pending_actions` as `refund.request` before the `Refund` document
  even exists, per the spec, regardless of amount). `PATCH
  /refunds/:id/review` (`order_manager`/`admin`/`super_admin`) marks it
  `pending_approval` (or `rejected`). `PATCH /refunds/:id/approve`
  (`admin`/`super_admin`): `super_admin` approves any amount directly;
  `admin` approves directly only at/below
  `ApprovalSettings.refundAutoApproveThresholdBDT`, otherwise the attempt is
  routed through `pending_actions` (`refund.approve`) instead of applying.
  Approval transitions the linked `Order.status` to `"refunded"` (via the
  existing `order.service.ts#updateOrderStatus`, reusing its transition
  validation) and **auto-logs a confirmed `Expense`** (category `"refund"`,
  linked via `linkedExpense`/`linkedRefund`) — exactly as the spec requires.
  Two UIs drive this: `/admin/refunds` for staff, and the customer's own
  "Request a Refund" action in `components/account/OrderHistory.tsx` — it
  appears on an order card only once `Order.status === "returned"` (matching
  the backend's own precondition, so the button is never offered when the
  request would 400), pre-fills the amount with the order total, and is
  replaced by a read-only refund-status line once a request exists.
  `OrderHistory` gets that status by calling the same `GET /refunds` the
  admin page uses — the endpoint force-scopes a `customer` viewer to their
  own refunds server-side, so no per-order lookup endpoint was needed.

#### Purchasing: shops, batches & flexible landed costs

Every purchase is recorded as its own batch with its own cost breakdown, so
the real cost of the goods on the shelf is a fact the system can answer rather
than an estimate someone keeps in a spreadsheet.

**The additional-cost system is completely open-ended, and that is the whole
point.** `Purchase.costItems[]` holds `{name, amountBDT, note?, proof?,
addedBy, addedAt}` — **there is no category enum and no predefined list of
cost types, and none may be added**. The cost's identity is the free text the
person recording it types, so a dates batch ("Shipping", "Customs",
"Transport") and a watch batch ("Parts", "Repair", "Supplier Fee") both work
with no code change, and a product category nobody has thought of yet works
too. A purchase can carry any number of cost items. `Expense.category` is the
fixed-taxonomy model and is a *separate* concern (ongoing operational spend,
not per-batch landed cost) — the two are not merged and the enum from one must
not leak into the other.

The maths is **derived on every read, never stored** — Mongoose virtuals on
`Purchase`, the same reasoning as `computeCouponStatus()`: a stored total goes
stale the moment a cost is added, edited or removed, with no way to notice.

```
additionalCostBDT   = sum of every costItems[].amountBDT
totalLandedCostBDT  = productCostBDT + additionalCostBDT
unitCostBDT         = totalLandedCostBDT / quantity
```

Adding a cost item is therefore the only write; the totals follow. `formatBDT`
rounds to whole taka, so the per-unit figure is rendered with
`formatBDTPrecise` (`lib/utils.ts`) — 412.50 rounding to 413 would hide
exactly the difference the breakdown exists to show.

**Batches are kept separately, permanently.** `GET /purchases/product/:productId`
returns every *received* batch of a product newest-first with the unit cost
each one actually worked out to, plus a `averageUnitCostBDT` weighted across
them (not the mean of the per-batch unit costs). Nothing averages a single
"cost price" onto the product document, so a price rise between shipments stays
visible. Once a purchase is `received` its cost breakdown is **immutable** —
`assertEditable()` rejects any cost-item write, and the batch cannot be
deleted or cancelled. A correction is a new batch, the same rule the
append-only `Investment` ledger follows.

**Proof images**: each cost item may carry one receipt photo, uploaded through
the existing `upload` middleware and `uploadBufferToCloudinary()` (folder
`saudi-authentic-product/purchase-proofs`) — no parallel upload path. On
`POST /purchases` the up-front cost items' files arrive as `costProof0`,
`costProof1`, … so an item *without* a receipt doesn't shift the ones after it
onto the wrong index; that route inherits the shared 5MB/6-file limits, and a
batch needing more receipts adds them one at a time through `POST /:id/costs`,
which is unlimited.

**Status pipeline**: `draft` → (`awaiting_stock_approval`) → `received`, plus
`cancelled`. A `draft` is freely editable; `cancelled` and `received` are not.

**Receiving moves stock, so it goes through the existing approval gate rather
than around it.** `PATCH /purchases/:id/receive` on a batch linked to a
catalogue variant applies `+quantity` immediately **only** for `super_admin`;
every other role (Admin included) gets `202 {pendingActionId}`, the batch sits
at `awaiting_stock_approval`, and the live count is untouched until a Super
Admin grants it — identical to the rule in "Stock-change approval gate" above.
The action type is `purchase.receive` and its handler is registered at the
bottom of `purchase.service.ts` (the service imports `pendingAction.service`
to *request* a grant, so the reverse import would be circular). The movement
is written to `InventoryLog` with the new reason `purchase_received` rather
than `manual_adjustment`, so a receipt is distinguishable from a correction in
the stock history. A purchase with **no** catalogue link has no stock to move
and is simply marked received — that is the path for packaging, consumables
and anything else not in the catalogue.

**Shop scoping** (`Shop` model, `User.assignedShops[]`,
`shop.service.ts#resolveShopScope`): `super_admin` — and any role holding
`shops.manage`, which is `admin` by default — sees and manages every shop.
Everyone else, Co-Admin included, is scoped server-side to the shops listed in
their own `User.assignedShops`, on every read *and* every write: a shop filter
in the query string narrows that scope but can never widen it, and recording a
purchase against an unassigned shop is a 403. The scope **fails closed** —
returning an empty array is meaningful and different from "no restriction", so
a staff member nobody has assigned a shop to sees nothing rather than
everything. A shop can't be deleted while purchases reference it or staff are
assigned to it (deactivate it instead), because those purchases carry the cost
history the module exists to preserve. `npm run seed` creates one default shop
(code `MAIN`) so the module is usable immediately.

Frontend: `/admin/purchases` is the batch list (shop/status filters, a row per
batch showing landed cost and unit cost) with a detail modal carrying
`PurchaseSummary` (the maths spelled out, not reduced to one number) and
`PurchaseCostEditor` (add/edit/remove costs, view receipts). `/admin/shops` is
shop CRUD plus the per-staff assignment picker. Both are nav-gated by
`purchases.view` / `shops.view`; as everywhere else in this project that is
visibility polish, and `requirePermission(...)` plus the shop scope on the
route are the real boundary.

**Deliberately not wired into `/finance`.** `getFinanceSummary` derives its
expense total from confirmed `Expense` documents; auto-logging a purchase
there as well would double-count anything a user also recorded as an expense.
Purchase costs are landed-cost accounting for a batch, and the finance summary
is operational spend — joining them is a decision for whoever owns the
finance model, not a side effect of this module.

#### Staff HR additions (NID, editable joining date, daily allowance)

Three small, independent additions to the existing staff-management and
salary surfaces:

- **NID number + card image** (`User.model.ts#IStaffMeta.nidNumber`/
  `nidImage`): `nidNumber` is a plain string set at staff creation
  (`createStaffSchema.staffMeta.nidNumber`, optional) or corrected later via
  `PATCH /users/:id/staff-meta` (`updateStaffMetaSchema`) — same
  admin/super_admin-only `employees.manage` gate as the rest of staff-meta,
  no extra protection beyond that (same treatment as `department`/
  `baseSalaryBDT`, not a `select: false` secret). The photo goes through a
  dedicated `PATCH /users/:id/staff-meta/nid-image` (multipart, one file)
  handled by `user.service.ts#updateStaffNidImage` — identical pattern to
  `updateMyAvatar`: deletes the old Cloudinary image (folder
  `saudi-authentic-product/staff-nid`) before uploading the new one.
  `/admin/employees`'s Employee form shows both fields (edit mode only for
  the image — a brand-new employee has no id to attach it to yet); the
  shared `components/account/ProfileSection.tsx` renders a read-only "NID
  Information" card for the staff member themselves whenever
  `user.staffMeta` has either field set — they can see what's on file, only
  an admin/super_admin can change it.
- **Editable `staffMeta.joinedAt`**: previously hardcoded to `new Date()` at
  creation with no way to correct it afterward. `createStaffSchema` now
  accepts an optional `joinedAt` (defaults to today when omitted, unchanged
  behavior for existing callers) and `updateStaffMetaSchema` accepts it too,
  so `PATCH /users/:id/staff-meta` can fix a wrong joining date after the
  fact. The Employee form's "Joined Date" field round-trips
  `staffMeta.joinedAt` (falling back to `user.createdAt` display-only when
  unset) via a plain `<input type="date">`.
- **`SalaryPayment.dailyAllowanceBDT`** (`models/SalaryPayment.model.ts`):
  an optional line item (default 0) alongside the existing `amountBDT`,
  entered manually at creation the same way `amountBDT` itself is — there is
  still no automatic attendance-based computation of anything salary-related.
  `amountBDT`'s meaning is unchanged ("base salary"); the payable total
  everywhere it's shown (admin `/admin/salary` table, `/employee/salary`
  history, the employee dashboard's "Latest Salary" card,
  `sendSalaryPaymentEmail`) is `amountBDT + dailyAllowanceBDT`, computed at
  render/send time, never stored as a combined figure. No new route — it
  rides along in the existing `POST /salary-payments` body
  (`createSalaryPaymentSchema.dailyAllowanceBDT`, optional). Tested in
  `server/src/tests/integration/staffHr.integration.test.ts` alongside the
  NID additions above.

#### Homepage content management (not a general CMS)

`/admin/homepage` and its backing models (`HeroSlide`, `HomepageSection`) let
admins/super-admins edit the **homepage only** — this is intentionally scoped,
not a page builder:

- **Hero slides** (`HeroSlide`): freely creatable/orderable/deletable —
  image, title, subtitle, CTA label/href, an optional **secondary** CTA
  label/href, sort order, active flag. **The storefront hero is
  image-only** — `HeroCarousel.tsx` renders exclusively the slide's
  `image`; `title`/`subtitle`/`ctaLabel`/`ctaHref`/`secondaryCtaLabel`/
  `secondaryCtaHref` are still stored and still editable from
  `/admin/homepage`, but exist purely as an internal label for that row in
  the admin table (`HeroSlideForm.tsx` shows an inline note saying so) —
  none of them render publicly. All active slides render as an
  auto-rotating, looping single-image carousel; a single slide (or none —
  falling back to the `hero` homepage section's own admin-uploaded image)
  renders as a static image with no controls. Managed at `/admin/homepage`:
  add/edit, up-down reorder arrows, a click-to-toggle Active badge in the
  table (no need to open the form), and delete. **Deletion is
  `admin`/`super_admin` only** — a `co_admin` creates, edits, reorders and
  disables slides but cannot delete one, per the project-wide convention
  that Co-Admin never deletes; disabling takes a slide off the storefront
  just as effectively. Seeded on first `npm run seed` with two starter
  "Premium Dates" slides (reusing the same artwork as the homepage
  `banner`-type seeds, uploaded separately to Cloudinary folder
  `saudi-authentic-product/hero`), freely replaceable from `/admin/homepage`
  like any other hero slide.

  Carousel behaviour: autoplay every 4.5s, previous/next arrows **hidden until
  the banner is hovered or focused** (`opacity-0 group-hover:opacity-100
  group-focus-within:opacity-100`, so they never sit visible over the image
  at rest), pagination dots rendered **below** the image (not overlaid on
  top of it) with `aria-current`, horizontal swipe on touch/pen pointers
  (mouse drags are left alone so the hover-reveal still works normally on
  desktop), and pause-on-hover/pause-on-focus for autoplay (the same
  hover/focus state that reveals the arrows). Manual navigation **restarts**
  the autoplay timer via a `restartKey` state bumped by `goTo()` — without
  it a click landing late in the cycle was followed almost immediately by an
  automatic advance, which read as the carousel jumping away from the slide
  the visitor just picked. Autoplay is skipped entirely when the viewer has
  `prefers-reduced-motion: reduce`, read through `useSyncExternalStore` (not
  a `useEffect`, which this project's lint config rejects for setState).
  Off-screen slides are `aria-hidden`.

  **There is no hardcoded slide content in the component.** Do not
  reintroduce a headline, paragraph, or CTA button into `HeroCarousel` — a
  fixed text overlay used to render here (with a further hardcoded "Explore
  Dates" secondary button) and was deliberately removed in favor of a pure
  image-only banner; the title/subtitle/CTA fields on `HeroSlide` remain
  admin-table labels only, not content to render.

  The banner is a **contained, compact promo card**, not a full-bleed hero:
  `HeroCarousel` wraps itself in a padded container and renders a rounded
  `max-w-[1200px]` block at `min-h-[240px]` / `sm:280px` / `lg:340px`, with
  the dots row directly beneath it (outside the rounded card, on the page
  background).

  **Its image is 100% database-driven — there is deliberately no image
  fallback in the component.** `image` is `slide.image?.url ??
  section?.image?.url ?? null`, and `HeroCarousel` only renders the
  `<Image>` when that is non-null. A bundled default (`/images/editorial/…`)
  used to be hardcoded here and silently overrode whatever the admin
  uploaded, which made the banner look un-editable — do not reintroduce one.
  With no image set the banner simply shows the brand's deep-green ground,
  which is a valid intentional look.

  **`updateHeroSlideSchema` is written out in full rather than derived with
  `createHeroSlideSchema.partial()`** — and any future update schema should
  be too. Zod 4's `.partial()` only makes keys optional; it does **not**
  strip `.default()`, so a derived schema silently fills in a default for
  every field the request omitted. The admin table PATCHes one field at a
  time (reorder sends only `sortOrder`, the Active toggle only `isActive`),
  so the derived schema reset the other: reordering a disabled slide
  published it again, and toggling a slide sent it to position 0.
  `updateHomepageSectionSchema` and `updateFooterColumnSchema` already avoid
  this by being spelled out; `updateNavLinkSchema`,
  `updateCategorySchema`, `updateProductSchema` and `updateTaskSchema` are
  still `.partial()`-derived over defaulted fields and carry the same latent
  behaviour (their admin forms happen to submit every field, so it does not
  currently bite).
- **Homepage sections** (`HomepageSection`): a **fixed enum** of nine
  types — `hero`, `trustStrip`, `featuredCategories`, `bestSellers`,
  `productStory`, `customerReviews`, `promoBanner`, `productShowcase`,
  `banner`. The first six are singleton documents (unique index on `type`), lazily seeded
  from `HOMEPAGE_SECTION_DEFAULTS`, editable (title/subtitle/description/
  image/visibility/sort order) but **not creatable or deletable**.
  `trustStrip` is the homepage's benefit/trust icon row (e.g. "100%
  Authentic", "Fast Delivery") — its own reorderable/toggleable section
  (previously hardcoded inside the hero banner) with a `blocks[]` array of
  `{icon, label, isVisible}`, `icon` drawn from the same allow-listed
  lucide-icon set `StaticPage`'s value-highlight blocks use
  (`STATIC_PAGE_BLOCK_ICONS`), edited via the same add/remove/reorder block
  editor pattern as `StaticPageForm.tsx`. `promoBanner`,
  `productShowcase` and `banner` are unlimited/freely creatable and
  deletable. `promoBanner` is for ad-hoc promotional banners
  (image/description/CTA), each rendered as its own full-width section
  inline in page order. `productShowcase` renders a configurable product
  grid — `productMode` is `"category"` (paired with `categorySlug`),
  `"bestSellers"`, `"newArrivals"` (backend `sort=newest`), or `"onSale"`
  (client-computed from `compareAtPriceBDT`, shared with `/offers` via
  `lib/productOffers.ts`), plus a `limit`. This is how admins add things
  like "Premium Dates", additional date-variety showcases, or — once real
  stock exists — a Watches/Chocolates showcase, with no code change; a
  showcase for a category with zero active products simply renders nothing
  rather than a broken/empty section. `banner` is different from
  `promoBanner` in the data model — every visible `banner` section is
  meant to be collected together and rendered as one image-only carousel
  rather than one per document — but **`banner`-type sections are
  currently not rendered anywhere on the storefront homepage**:
  `app/(site)/page.tsx`'s section switch has no `"banner"` case (it falls
  through to `default: return null`), because rendering them duplicated the
  hero carousel's own images directly beneath it. The type, its admin CRUD
  at `/admin/homepage`, its model/validator, and the `BannerCarousel.tsx`
  component (built on native horizontal CSS scroll-snap, two-up on desktop)
  still exist and still work — an admin can still create/edit/reorder/
  delete `banner` sections — they simply have no current storefront output.
  `npm run seed` still seeds three starter "Premium Dates" `banner`
  documents (titled `demo1`/`demo2`/`offer`, Cloudinary-uploaded from
  `server/src/seed/assets/`) for that same reason: the admin-side feature is
  intact, only its homepage rendering was removed.

There is no arbitrary page/route creation and no rich-text/WYSIWYG block
editor — see "Static page content management" below for `/about`,
`/contact`, and `/shipping-policy`'s own (separate, fixed-type) content
system, and "Navigation & footer content management" below for what else is
admin-editable outside the homepage. `SiteSettings` (site name, logo,
`announcementEnabled`/`announcementText`, contact email/phone, footer
tagline, social links — `/admin/settings`) is a separate, unrelated
singleton, not part of the homepage-section system.

**Announcement strip** (`components/layout/AnnouncementBar.tsx`, rendered by
`app/(site)/layout.tsx`): the thin green bar above the main navbar, for
occasions like Eid or a sale. It is **opt-in and off by default** —
`SiteSettings.announcementEnabled` defaults to `false`, and the component
renders `null` unless that flag is `true` *and* `announcementText` is
non-blank (so clearing the text hides the strip too, and an empty green bar
can never ship). Both the switch and the text are edited together at
`/admin/settings`, so enabling/disabling it seasonally needs no code change
or redeploy. A settings document saved before this field existed has no
value for it, which reads as falsy — existing installs stay hidden until
someone opts in.

`announcementEnabled` is validated with `booleanish` (from
`validators/common.validator.ts`), **not** `z.coerce.boolean()`: `PATCH
/site-settings` takes multipart/form-data for the logo upload, so the toggle
arrives as the string `"false"`/`"true"`, and plain coercion would read
`"false"` as truthy and make the strip impossible to switch back off. Follow
that pattern for any future boolean on a multipart endpoint.

#### Static page content management

`/admin/pages` and its backing model (`StaticPage`) let admins/super-admins
edit the body copy of the three static informational pages — `about`,
`contact`, `shippingPolicy` — a **fixed enum**, same lazily-seeded-singleton
pattern as `HomepageSection`'s five fixed types: one document per type
(unique index on `type`), seeded from `STATIC_PAGE_DEFAULTS` on first read,
editable but **not creatable or deletable**, and not a general page builder
— there is still no way to add an arbitrary new page or route. Each
document holds `heroTitle`, an optional `heroDescription` (About's two
intro paragraphs, stored as one string split on a blank line),
an optional `heroImage`, an optional `introText`/`addressLine` (Contact
only), a `blocks[]` array (About's four value-highlight tiles with an
allow-listed lucide `icon` name, or Shipping Policy's list of policy
sections — each block has its own `isVisible`, replaced wholesale on
update, ordered by array order), and optional `ctaTitle`/`ctaDescription`/
`ctaButtonLabel`/`ctaButtonHref` (About's closing banner — rendered only
when `ctaTitle` is set). `/admin/pages`'s form (`StaticPageForm.tsx`) shows
only the fields relevant to the selected page type (mirrors
`HomepageSectionForm`'s per-type `FIELD_VISIBILITY` pattern) via a
type-selector tab bar. Contact's phone/email/social links are **not**
duplicated here — they still come from the existing `SiteSettings` singleton
(`/admin/settings`); `StaticPage`'s `contact` document only adds the page's
own intro paragraph and address line. The three public pages
(`frontend/src/app/(site)/{about,contact,shipping-policy}/page.tsx`) are
`force-dynamic` server components that fetch their content from
`GET /static-pages/:type` (Contact also fetches `SiteSettings` in parallel)
— nothing on these three pages is hardcoded body copy anymore, only their
Tailwind layout/markup.

#### Navigation & footer content management

Two more freely-creatable/orderable/deletable collections extend admin
control beyond the homepage to the storefront's global chrome — same
lazily-seeded-defaults, `isVisible`/`sortOrder` pattern as `HeroSlide`, but
with no fixed/uncreatable rows (everything in both is freely add/edit/
delete/reorder):

- **`NavLink`** (`label`, `href`, `sortOrder`, `isVisible`,
  `openInNewTab`) — the storefront header's top-level nav links
  (`Header.tsx`, via `lib/hooks/useNavLinks.ts`), managed at
  `/admin/navigation`. The "Categories" dropdown (live category list, hover
  menu) is a separate, fixed structural element always rendered after the
  dynamic links — it is not itself a `NavLink` row and isn't reorderable
  relative to them.
- **`FooterColumn`** (`heading`, `sortOrder`, `isVisible`, an embedded
  `links[]` of `{label, href, sortOrder}`, replaced wholesale on update) —
  the storefront footer's link columns (`Footer.tsx`, an async server
  component fetching both this and `SiteSettings` server-side), managed at
  `/admin/footer`. Social icons in the footer's bottom row come from
  `SiteSettings.socialLinks` (edited on `/admin/settings`, alongside the
  existing branding/contact fields) and render via
  `components/ui/SocialIcon.tsx` — a small stroked-circle-with-monogram
  glyph (not a brand logo) since lucide-react dropped brand/logo icons for
  trademark reasons; do not add a brand-icon dependency to restore literal
  logos without checking that constraint first.

Both `/admin/navigation` and `/admin/footer` are `admin`/`super_admin`
only (nav-hidden from `co_admin`, same restricted-page pattern as
`/admin/homepage`/`/admin/settings` — see "Co-admin admin-portal UX"
below), and both public list endpoints are visible-only/sorted by default
(`includeHidden=true` for the admin views).

#### Middlewares (`src/middlewares`)

- `authenticate` — JWT from `accessToken` cookie or `Authorization: Bearer`; checks `isActive` + `tokenVersion`, and attaches `isEmailVerified` onto `req.user` alongside `id`/`role`/`tokenVersion`. `attachUserIfPresent` — same but non-failing (optional auth).
- `requireEmailVerified` — must run after `authenticate`; 403s a `customer` whose `isEmailVerified` is `false`, exempts every staff role. Applied to `POST /orders` and `POST /reviews/product/:productId` — see "Email verification" below.
- `requirePermission(...permissions)` / `requireAllPermissions(...)` — the primary authorization gate (`rbac.middleware.ts`); passes when the caller holds any (respectively all) of the listed permissions, resolved onto `req.user.permissions` by `authenticate`. See "Roles & permissions" above.
- `authorize(...roles)` / `authorizeSelfOrRoles(getOwnerId, ...staffRoles)` — role gating, still present for checks that really are about role identity rather than capability; ownership checks are otherwise done ad hoc inside controllers/services.
- `validate({body,query,params})` — zod-parses and **replaces** the field via `Object.defineProperty` (Express 5 `req.query` gotcha, see below).
- `sanitizeRequest` — `express-mongo-sanitize` on body/params/query, same `Object.defineProperty` fix.
- `upload` (`upload.middleware.ts`) — multer memory storage, image-only, 5MB/6-file limits.
- `parseMultipartJsonFields(fields[])` — JSON.parses specified multipart body fields (e.g. product `variants`/`categories`/`highlights`) before zod validation.
- `authLimiter` (15min/20req, auth endpoints), `apiLimiter` (15min/600req, general) — `rateLimit.middleware.ts`.
- `notFoundHandler` / `errorHandler` — central error formatting (`ApiError`, Mongoose `ValidationError`/duplicate-key 11000→409/`CastError`, JWT errors); stack trace only outside production.

Core utilities (reuse, don't reinvent):
- `catchAsync(handler)` — wraps async route handlers, forwards rejections to `next`.
- `sendSuccess(res, statusCode, message, data?, meta?)` — response envelope `{success, message, data, ...meta}`.
- `ApiError.badRequest/unauthorized/forbidden/notFound/conflict/internal(message, errors?)`.
- `paramStr(req.params.x)` — narrows Express's `string | string[]` param type.

**Auth**: httpOnly cookies `accessToken` / `refreshToken` (see `utils/cookies.ts`,
`utils/jwt.ts`). Roles: `customer | employee | delivery_agent | co_admin |
order_manager | admin | super_admin` (`constants/roles.ts`).

**Authorization is permission-based** (see "Roles & permissions" below):
routes call `requirePermission("orders.manage")` rather than listing roles,
and a role's permission list lives in the database. The seven built-in roles
are unchanged and their seeded permission sets reproduce the old role matrix
exactly, so the conventions below still describe what each role can do — they
are now data rather than hardcoded route arguments. Convention: co_admin can run day-to-day HR (attendance/
leave/tasks/performance) but never touches salary, staff role/status, or
deletes — those are admin/super_admin only. `order_manager` gets Admin Portal
access scoped to Orders only (verify/dispatch/assign — see "Order status
pipeline & delivery" below); `delivery_agent` never reaches `/admin` at all
— it's excluded from `ADMIN_PORTAL_ROLES` and gets its own minimal Delivery
Portal (`/delivery`) instead, self-scoped to its own assigned orders.

**Registration** (`auth.validator.ts#registerSchema`, `auth.service.ts#registerCustomer`):
`name`, `email` (unique), `password`+`confirmPassword` (must match; password
must be 8+ chars with an uppercase letter, a lowercase letter and a digit —
same regex enforced client-side live in `lib/passwordStrength.ts`), optional
`phone` (also checked for uniqueness — a second registration with an
already-used phone number 409s just like a duplicate email) and an optional
`address` object (`fullAddress`/`district`/`cityArea`) that, if present,
requires `phone` and is saved as the new customer's first (default) address
in the same request — no separate follow-up call. There is no phone-based
*login* or SMS-OTP verification (the reference design's "Signup with Mobile
Number + OTP" panel was deliberately not built — no SMS gateway is
configured anywhere in this project); phone is only ever a supplementary
contact field alongside the required email login identifier. A new customer
is created with `isEmailVerified: false` and is still logged in immediately
(cookies set on the register response, same as before) — see "Email
verification" below for what that gates.

**Email verification** (`User.model.ts#isEmailVerified`,
`utils/jwt.ts#signEmailVerificationToken`/`verifyEmailVerificationToken`,
`auth.service.ts#verifyEmail`/`resendVerification`,
`middlewares/auth.middleware.ts#requireEmailVerified`): registering fires a
(best-effort, fire-and-forget) email with a link
`{CLIENT_ORIGIN}/account/verify-email?token=...` carrying a JWT signed with a
`purpose: "email_verification"` claim and a 24-hour expiry — no
`tokenVersion` binding, since verifying isn't a session-invalidating action.
`POST /auth/verify-email` distinguishes three outcomes: a genuinely expired
token (`jsonwebtoken`'s `TokenExpiredError`) vs. any other invalid/malformed
token vs. a valid-but-already-verified account (`data.status:
"already-verified"`, not an error — a harmless re-click of an old email).
`POST /auth/resend-verification` mirrors `forgot-password`'s
existence-hiding pattern: always responds success, silently no-ops for an
unknown email or an already-verified account — this is also what powers the
self-service "Verify Email" button described below, since it only needs the
viewer's own (already-known) email. `requireEmailVerified` (applied after
`authenticate`) blocks the two customer-only write actions — `POST /orders`
and `POST /reviews/product/:productId` — for a `customer` whose
`isEmailVerified` is still `false`; staff roles are always exempt from this
specific write-blocking gate. That exemption is narrow and gate-specific,
not a blanket "staff skip verification" — see below.

**Every role verifies its email, not just customers.**
`user.service.ts#createStaffAccount` creates a new staff account (however
its role) with `isEmailVerified: false` and fires the same verification
email `registerCustomer` does — an admin typing in a new hire's address
doesn't guarantee that inbox is actually reachable by the new hire, so the
same link-based proof applies. Two exceptions, both because the email is
already known-good by construction rather than merely asserted: **Google
Sign-In** accounts (`auth.service.ts#googleAuth`) stay `isEmailVerified:
true` since Google already verified ownership of that address, and every
**seeded** account (`seed/seed.ts`, `npm run seed`) stays pre-verified as a
local-dev/bootstrap convenience — there's no inbox to click through in a
fresh seed, and an unverified seeded Super Admin would otherwise nag itself
on every login with nobody able to resolve it. Being unverified never blocks
a staff member from using their portal (`requireEmailVerified` only ever
gates the two customer-only actions above) — it's a nag to resolve, not a
lockout.

`GET /auth/me`'s `user.isEmailVerified` drives the frontend, for every role:
**`components/account/ProfileSection.tsx`** (shared by the customer account
portal's Manage Profile tab, `/admin/profile`, `/employee/profile`, and
`/delivery/profile` — one component, no per-portal duplication) renders an
"Email Verification" card — a green **Email Verified** badge once
`isEmailVerified` is `true`, otherwise a **Verify Email** button that calls
`resendVerification(user.email)` and flips to "Verification Email Sent".
Separately, `/account`'s `EmailVerificationBanner` (customer-only, resend
button) still nags above the dashboard, and `/checkout`
(`CheckoutClient.tsx`) shows the same banner instead of the order form —
both disappear once `AuthContext` re-fetches `/auth/me` with
`isEmailVerified: true`. `frontend/src/app/(site)/account/verify-email/page.tsx`
handles the link itself (role-agnostic — it works for any account, not just
customers), distinguishing verified / already-verified / expired / invalid /
missing-token states, with a resend form (plain email input, works whether
or not the visitor is logged in) on the two error states; on a successful
verify it also calls `AuthContext#refreshUser()`, so if the browser that
clicked the link is also signed in as that user, the profile page's badge
flips immediately instead of waiting for the next navigation.

**Forgot / reset password** (`auth.service.ts#forgotPassword`/`resetPassword`,
`utils/jwt.ts#signPasswordResetToken`) works identically for **every role**
(customer, employee, delivery_agent, co_admin, order_manager, admin,
super_admin) — it's a single flow keyed by email against the shared `User`
model, not a per-role system. `POST
/auth/forgot-password` always responds success without revealing whether the
email exists, and (best-effort, fire-and-forget) emails a link
`{CLIENT_ORIGIN}/account/reset-password?token=...` carrying a JWT signed with
a `purpose: "password_reset"` claim and a 30-minute expiry. `POST
/auth/reset-password` requires `newPassword`+`confirmPassword` (same
strength/match rules as registration) and verifies the token's `purpose` and
`tokenVersion`; on success it bumps the user's `tokenVersion`, which both
sets the new password **and** invalidates the token (and every other active
session) so it cannot be replayed. Same "Forgot password?" link and reset
page serve all seven roles — there's no separate admin/employee login screen
(see `/account` below), so no extra wiring was needed for staff roles.

**Google Sign-In** (`config/google.ts`, `POST /auth/google`): verifies the ID
token from Google Identity Services' "Continue with Google" button
server-side via `google-auth-library`, using it to find-or-create a
`customer` user by email (a first-time Google sign-in gets a random unusable
password so it still satisfies the `User` schema — reuses the same JWT
session issuance as password login, not a separate auth system). Gated by
`isGoogleConfigured` (`Boolean(env.GOOGLE_CLIENT_ID)`) — mirrors the
Cloudinary/SMTP pattern exactly: unset → the endpoint 503s with a clear
message and the frontend's `GoogleAuthButton` renders nothing, so the rest of
the app is unaffected. `GOOGLE_CLIENT_ID` is a public client identifier (not
a secret); the same value must also be set as the frontend's
`NEXT_PUBLIC_GOOGLE_CLIENT_ID`. See `backend/.env.example` for the Google
Cloud Console setup steps — an OAuth Client ID has not been provisioned on
this machine, so Google Sign-In is wired end-to-end but inactive until one is
added.

#### Security hardening (2FA, lockout, idle timeout, impersonation)

All four policy numbers live in `constants/security.ts` as **fixed policy
constants, deliberately not `ApprovalSettings` fields** — they are not
Super-Admin-tunable, so the "any new Super-Admin-editable threshold belongs
on `ApprovalSettings`" rule doesn't apply to them. The `User` model gained
`failedLoginAttempts`, `lockedUntil`, `lastSeenAt`, `twoFactorEnabled`,
`twoFactorSecret`/`twoFactorPendingSecret`/`twoFactorRecoveryCodes` (all
three `select: false` **and** stripped in the `toJSON` transform — defense in
depth, same pattern as `Order.otpCode`).

- **Account lockout** (`auth.service.ts#login`): a wrong password increments
  `failedLoginAttempts`; reaching `MAX_FAILED_LOGIN_ATTEMPTS` (5) sets
  `lockedUntil` to `ACCOUNT_LOCK_DURATION_MS` (15 min) ahead, resets the
  counter, fires `sendAccountLockedEmail`, and 403s. While locked, even the
  *correct* password is refused. Any successful password check clears both
  fields. `PATCH /users/:id/unlock` (`admin`/`super_admin`) clears a lockout
  early and is audit-logged; `/admin/customers` and `/admin/employees` show
  a "Locked" badge plus an "Unlock" action.
- **Two-factor authentication** (`services/twoFactor.service.ts`, TOTP via
  `otplib` + `qrcode`). **`otplib` is pinned to v12 on purpose** — v13 is
  ESM-only and its `@scure/base` dependency cannot be parsed by this repo's
  CommonJS ts-jest setup, breaking every test suite. Do not upgrade it
  without migrating Jest's `transformIgnorePatterns` first. Enrolment is
  two-step so an abandoned setup never half-enrols an account: `POST
  /auth/2fa/setup` parks a secret in `twoFactorPendingSecret` and returns the
  otpauth URI + a QR data URL; `POST /auth/2fa/enable` verifies a live code,
  promotes the secret, and returns 8 single-use recovery codes (bcrypt-hashed
  at rest — the plaintext exists only in that one response). `POST
  /auth/2fa/disable` requires the account password. At login, a 2FA-enabled
  account gets `{requiresTwoFactor: true, challengeToken}` instead of a
  session — a 10-minute, `purpose`-scoped, `tokenVersion`-bound JWT — which
  `POST /auth/2fa/verify` exchanges for real cookies. `verifyTwoFactorCode()`
  accepts a TOTP code *or* a recovery code, splicing a consumed recovery code
  out immediately so it can't be replayed. Frontend: `TwoFactorSection.tsx`
  inside `ProfileSection` (so every role's profile page gets it), and a
  code-entry step inside `AuthForms.tsx`.
- **Idle-session timeout** (`enforceInactivityWindow()` in
  `auth.middleware.ts`, plus `isStaffSessionIdle()` guarding
  `refreshSession`): staff roles only (`INACTIVITY_ENFORCED_ROLES`) —
  **customers are deliberately exempt**, since killing an idle storefront
  session mid-shop is a UX regression, not a security win. The `lastSeenAt`
  write is throttled to `ACTIVITY_WRITE_GRANULARITY_MS` (1 min) so an active
  session doesn't turn every authenticated request into a DB write. Note this
  is per-*user*, not per-device — there's one `lastSeenAt` per account.
- **Impersonation / support-login** (`user.service.ts#impersonateUser`,
  `POST /users/:id/impersonate`, `super_admin` only): mints a 30-minute
  `signImpersonationToken()` carrying the target's `sub`/`role`/
  `tokenVersion` plus an `impersonatedBy` claim. **No cookies are touched
  and no refresh token is issued** — the frontend holds it in
  `sessionStorage` and sends it as `Authorization: Bearer`
  (`client.ts#setImpersonationToken`), so the Super Admin's own cookie
  session stays intact underneath and "stop impersonating" is just dropping
  the token — no stop endpoint exists or is needed. `authenticate` skips the
  idle-timeout check and the `lastSeenAt` write for an impersonation token
  (it's the Super Admin's activity, not the target's) and surfaces
  `req.user.impersonatedBy`, which `GET /auth/me` returns so
  `ImpersonationBanner.tsx` (mounted in the root layout) can't be navigated
  away from. Impersonating another `super_admin` 403s. Start is audit-logged.

**Uploads**: `multer` (memory storage) → `uploadBufferToCloudinary()` in
`config/cloudinary.ts`. Guarded by `isCloudinaryConfigured`; returns a clear
503 if Cloudinary env vars are unset rather than a confusing SDK error.
`deleteCloudinaryImage()` is best-effort and swallows errors.

**Email**: `services/email.service.ts` exports `sendPasswordResetEmail`,
`sendDeliveryOtpEmail`,
`sendStaffWelcomeEmail`, `sendOrderConfirmationEmail`, `sendLeaveStatusEmail`,
`sendTaskAssignedEmail`, `sendSalaryPaymentEmail`, `sendAccountLockedEmail`,
`sendNewOrderStaffAlertEmail`, `sendLowStockAlertEmail`,
`sendDeliveryFailedAlertEmail` — all HTML via a shared
`layout()`/`button()` helper, routed through `safeSend()` (catches/logs,
never throws) → `config/mailer.ts` (nodemailer transporter, lazily created)
→ guarded by `isSmtpConfigured`. **All email sends are fire-and-forget
(`void sendXEmail(...)`, never `await`)** — confirmed at every call site
(`leave.service.ts`, `order.service.ts`, `user.service.ts`, `auth.service.ts`,
`task.service.ts`, `salary.service.ts`, `notification.service.ts`) — a real
SMTP round-trip is too slow
to block the request, and `safeSend()` already swallows and logs failures so
callers never need to handle rejections.

**Operational notifications** (`services/notification.service.ts`): the last
three senders above are staff *fan-outs* rather than one-recipient
transactional mail — `notifyNewOrder`, `notifyLowStock`,
`notifyDeliveryFailed` resolve every active user in the roles that own that
workflow (`order_manager`/`co_admin`/`admin`/`super_admin` for order events;
`co_admin`/`admin`/`super_admin` for inventory) and email them all. This is
deliberately **not a general notification matrix** — there is no per-user
subscription model, no in-app inbox, and no digest/batching; it is three
specific events chosen for day-to-day operations. The low-stock alert fires
only on the *crossing* (stock was above the variant's `lowStockThreshold`
before the decrement and is at/below it after), so a persistently low variant
doesn't email staff on every sale. The whole module swallows its own errors
(`fanOut`'s try/catch) on top of `safeSend()`, so a mail outage can never
fail the order or delivery update that triggered it.

**⚠️ Express 5 `req.query` gotcha**: `req.query` is a **getter with no
setter** that **re-parses `req.url` from scratch on every access** (see
`express/lib/request.js`). Plain reassignment (`req.query = x`) throws;
*mutating* the object one access returns is silently discarded the next time
anything reads `req.query` (this broke `express-mongo-sanitize`'s NoSQL
sanitization until fixed). The fix, already applied in both
`middlewares/validate.middleware.ts` and `middlewares/sanitize.middleware.ts`,
is `Object.defineProperty(req, "query", { value, writable: true, configurable: true, enumerable: true })`
— pins the property so it stops being re-derived. Follow this pattern for any
new middleware that needs to modify `req.query`.

**Testing**: `backend/src/tests/*.test.ts` — 10 unit-style spec files
(`apiError`, `app`, `booleanish`, `errorMiddleware`, `jwt`, `params`, `rbac`,
`shipping`, `slugify`, `validateMiddleware`; `rbac.test.ts` includes cases
locking in the `order_manager`/`delivery_agent` role strings), plus
`backend/src/tests/integration/*.integration.test.ts` — real
HTTP-through-Mongoose integration specs (`auth`, `emailVerification`,
`catalog`, `order`, `orderStatus`, `task`, `coupon`, `approvalGate`,
`stockApproval`, `finance`, `security`, `notification`, `siteSettings`,
`heroSlide`, `permissions`, `purchase`, `staffHr`) run against an
actual in-memory MongoDB via `mongodb-memory-server`
(`tests/integration/setup.ts` starts/stops it and wipes collections between
tests; `tests/integration/helpers.ts` creates a DB-backed user and signs a
bearer token for it, bypassing `authLimiter` so RBAC-focused tests aren't
rate-limited). They exercise `createApp()` with `supertest` end-to-end:
register/login/`me`/logout, category+product RBAC and creation (including
`catalog.integration.test.ts`'s admin-submits/Super-Admin-grants/then-public
walk through the `product.create` approval gate), order
creation/stock-decrement/tracking/ownership, `orderStatus.integration.test.ts`
(full pending→delivered pipeline walk with actor/role history assertions —
now sending the delivery OTP as its own explicit step, separate from the
`out_for_delivery` transition — invalid-transition/terminal-status rejection,
admin's actor-gate-bypass-but-not-adjacency-table override, `order_manager`/
`delivery_agent` RBAC against unrelated resources, delivery-agent
self-scoping between two different agents, the OTP flow's owner-only/
staff-hidden visibility, that a delivery agent can never reach `delivered`
through the generic status endpoint, and OTP-attempt-limiting — repeated
wrong codes 400 with a remaining-attempts count, the limit-reaching attempt
invalidates the code outright (the previously-correct code no longer works
either), and a fresh send resets attempts and works), `task.integration.test.ts` (required `type` field,
`type` query filtering), `coupon.integration.test.ts` (discount-size gating
— auto-approve/pending/forbidden thresholds for `co_admin`, plus a
super_admin grant materializing the original payload),
`approvalGate.integration.test.ts` (product-deletion gating across
`super_admin`/`co_admin`/`admin`, grant/deny, audit-log recording and
per-role visibility scoping, threshold-settings edit),
`stockApproval.integration.test.ts` (stock gating from both entry points —
that live stock and `InventoryLog` stay untouched until a grant, that a deny
leaves them untouched permanently, that `admin` is gated too, that a queued
delta is re-evaluated against stock that moved while it waited, that one
product submit ships its description immediately while holding its stock,
that an unchanged stock value creates no request, and that `employee` can
read `GET /inventory/stock` but gets 403 on `POST /inventory/adjust`; new-
product-creation cases — that a `co_admin`'s (and an `admin`'s) whole new
product is queued rather than created, that nothing exists in the catalog
until a Super Admin grants it, that a denied request leaves nothing behind,
and that `super_admin` still publishes directly with real stock; variant-identity cases — an `_id`
survives an unrelated edit, a newly added variant gets a fresh one, a foreign
id is ignored, and reordering variants doesn't scramble which stock belongs
to which; overlapping-request cases — symmetric conflict flagging, no false
positive across different variants of one product, a conflict between the two
different stock action types, and the flag clearing plus the audit note once
one side is granted — plus the title/description half:
immediate application, field-level old/new audit entries naming only what
changed, no entry for a no-op submit, and super-admin visibility at
`/audit-logs`), `purchase.integration.test.ts` (the landed-cost maths over
arbitrarily-named cost items — including two batches whose cost vocabularies
share nothing — totals recomputing as costs are added and removed, per-batch
history with a weighted average unit cost, the receipt path through the stock
approval gate for both `super_admin` and `admin`, an unlinked batch receiving
without touching stock, a received batch refusing further cost edits, shop
scoping including a scoped viewer failing closed with no assignment and being
unable to widen scope with a `?shop=` filter, and the RBAC matrix),
`staffHr.integration.test.ts` (an NID number set at creation and corrected
via `staff-meta`, an NID image upload replacing — and deleting — the
previous one, a non-HR role 403ing on both, and a salary payment's
`dailyAllowanceBDT` defaulting to 0 when omitted, being visible in the
employee's own payment history, and adding to `amountBDT` correctly), and
`finance.integration.test.ts` (investment RBAC, co_admin expense submission
+ threshold-gated confirmation, a full refund walk from request through
Order-Manager review to Admin approval — including the above-threshold
grant path — asserting the order transitions to `"refunded"` and a linked
`Expense` is auto-logged, plus a customer-initiated request proving
`GET /refunds` scopes a customer to only their own),
`security.integration.test.ts` (lockout after N failed attempts + admin
unlock + counter reset, TOTP enrolment/login-challenge/recovery-code
single-use, secret-and-recovery-code non-leakage through `GET /auth/me`,
staff-idle-timeout vs. customer-exempt, and impersonation RBAC including
the super-admin-on-super-admin refusal), and
`notification.integration.test.ts` (which staff roles each operational
alert fans out to, deactivated-staff exclusion, and that a mail failure
never propagates — it `jest.mock`s `email.service` and imports
`notification.service` *after* the mock, so the stubbed senders are what
gets wired in), `permissions.integration.test.ts` (the role/permission system — that a Super
Admin holds everything, that each built-in role's effective permissions equal
its documented defaults, that a custom role grants real API access and stops
granting it the moment it is deactivated, that an Admin cannot grant a
permission they lack or re-permission a built-in role, that the SUPER_ADMIN
role is uneditable, that a Super Admin's edit to a built-in role applies on
the very next request with no re-login, and that built-in or still-assigned
roles cannot be deleted), `heroSlide.integration.test.ts` (the homepage banner
carousel — active-only public listing vs. the admin's `includeInactive`
view, co-admin create with both CTAs, RBAC across customer/employee/
order_manager/anonymous, the image requirement, and the two halves of the
`.partial()`-default bug: a one-field toggle that leaves the other fields
alone and a reorder that leaves a disabled slide disabled; it `jest.mock`s
`config/cloudinary` because uploads are otherwise 503-guarded in the test
environment), and `siteSettings.integration.test.ts` (the announcement
strip's on/off switch — that it defaults to `false` on the lazily-seeded
singleton, that an admin can switch it on and edit its text in one request,
that the string `"false"` from the multipart form really switches it back
off, that the text survives being switched off so it can be reused, and that
`co_admin`/`order_manager`/`employee`/`customer` all get 403 while anonymous
gets 401). All suites run together via `npm test` (Jest +
ts-jest, `backend/jest.config.js`, `tsconfig.jest.json` since the main
`tsconfig.json` excludes `src/tests/**/*` from the build).

### Frontend (`frontend/src`)

```
app/(site)/...      Customer storefront (App Router route group)
app/checkout/...     Checkout flow — a TOP-LEVEL route (NOT inside (site)),
                      with its own layout.tsx, so it does not share the
                      storefront header/footer chrome
app/admin/...        Admin / Co-Admin / Super Admin / Order Manager portal (role-guarded)
app/employee/...     Employee portal (role-guarded)
app/delivery/...     Delivery Agent portal (role-guarded, self-scoped to own assigned orders)
components/ui/       Shared primitives: Button, ProductCard, SectionHeading, ProductVisual, etc.
components/<domain>/ Feature components (checkout/, product/, shop/, admin/, employee/, delivery/, home/, account/)
context/              AuthContext, CartContext, WishlistContext (React context, "use client")
lib/api/              One file per backend resource (products.ts, orders.ts, attendance.ts, ...),
                      all built on lib/api/client.ts's `api.get/post/patch/delete/postForm/patchForm`
lib/mappers.ts        Converts raw API shapes (types/api.ts, types/hr.ts) into the
                      storefront view-model shapes (types/product.ts) components consume
lib/hooks/            useProducts, useCategories, useProductsByIds (cart/wishlist resolution)
lib/roles.ts          Frontend copy of backend's role constants (apps don't share code — keep in sync manually)
types/api.ts          Types mirroring backend Product/Order/User/Review/Category/HeroSlide/HomepageSection/SiteSettings JSON
types/hr.ts            Types mirroring backend Attendance/Leave/Task/Performance/Salary/Inventory/Reports JSON
types/product.ts       Storefront view-model types (Product, Category, ProductVariant, ProductVisual, CartLine)
```

#### Storefront routes (`app/(site)`)

`/` (homepage, composed from admin-managed hero slides + homepage sections),
`/shop` (filterable catalog — see "Shop filter sidebar" below),
`/product/[slug]` (detail, `force-dynamic`),
`/categories`, `/offers` (products with a `compareAtPriceBDT` discount),
`/cart`, `/wishlist`, `/account` (customer dashboard — a persistent left
sidebar, `CustomerSidebar.tsx` — user card (avatar/name/email) + Dashboard /
My Orders / Wishlist / Address / Manage Profile nav + Logout, all in the
site's green-950/gold-500 palette — next to a content pane keyed off the
active tab: `DashboardOverview.tsx` (six real-data stat cards — total/
running orders, cart items, wishlist items, amount spent, saved addresses —
plus dark-header "Recent Orders" and "Wishlist Items" summary panels with
their own "All Orders"/"View More" shortcuts) or the existing `OrderHistory`
/ `AddressBook` / `ProfileSection` components, plus a Wishlist tab reusing
the same `ProductCard` grid as the standalone `/wishlist` page. Sidebar items
are deliberately scoped to features the API actually has — no
promo-code/payment-method/support-ticket nav items were added since no
backend exists for them. A signed-in staff account never sees this dashboard
at all — `staffPortalPath(role)` `router.replace()`s it straight to `/admin`,
`/employee`, or `/delivery` (whichever portal matches its role) while
rendering the loading placeholder, so there is no intermediate
"Dashboard / Logout" choice screen; each portal's own layout carries the
Sign Out control. When signed out, renders `AuthForms` —
the single Sign In / Register / Forgot Password form shared by **every**
role, see "Registration" and "Forgot / reset password" above), `/account/reset-password` (Set a New
Password — Confirm Password field + live strength meter, see above),
`/track-order` (public order-tracking form — order number + checkout email,
no login required; auto-prefills from a logged-in customer's own email and
from an `?orderNumber=` query param when arrived at via the "Track Order"
link on an order card; see "Public order tracking" above), `/about`,
`/contact`, `/shipping-policy`, `/faq` (plain static page, hardcoded Q&A
content — **not** wired into the `StaticPage` admin content system, which
stays a fixed three-type enum; see "Static page content management" below).
There is no standalone `/reviews` page —
reviews render inline on the product page and homepage, and are moderated
from `/admin/reviews`. `/checkout` is a separate top-level route (see folder
structure above), not part of `(site)`.

**`AuthForms`** (`components/account/AuthForms.tsx`) is the single Sign In /
Register / Forgot Password form used by customers *and* staff alike (there is
no separate admin/employee login page — see "Forgot / reset password"
above). Shared pieces reused elsewhere too: `components/ui/PasswordInput.tsx`
(show/hide eye-icon toggle, used on every password field across login,
register, reset-password), `components/ui/PasswordStrengthMeter.tsx` +
`lib/passwordStrength.ts` (live strength bar/label, same rule the backend
enforces), and `components/account/GoogleAuthButton.tsx` (renders Google's
official button via Google Identity Services, calls `/auth/google`; renders
nothing when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is unset).

#### Admin portal (`app/admin`) — fully built, not stubbed

Guarded as a group by `RoleGuard
allowed={["co_admin","order_manager","admin","super_admin"]}` in
`app/admin/layout.tsx`. Its shell (`AdminShell`) now follows the same
sidebar pattern as the Employee and Delivery portals (see below): the
desktop `<aside>` is its own `sticky top-0 h-screen overflow-y-auto` scroll
container, independent of the page content's scroll — without this, the
whole layout scrolled as one document and Next's default navigate-to-top
behavior reset the sidebar's scroll position on every click, which is why
clicking a nav item near the bottom used to jump the sidebar back to the
top. Below `lg`, the sidebar collapses into a hamburger-triggered slide-in
drawer (`mobileOpen` state, backdrop button, `animate-slide-in-left`) —
`AdminNav` takes an optional `onNavigate` prop (mirroring
`EmployeeNav`/`DeliveryNav`) that the drawer wires to close itself on link
click. Every page below does real CRUD against the live
API (loading/empty/error states via `EmptyState`/`TableSkeleton`/`ErrorState`,
modal forms via `Modal.tsx`, `PageHeader`, `StatusBadge`,
`AdminPagination`) — none are placeholders:

`/admin` (dashboard: revenue/orders/customers/active-products/low-stock/
pending-leaves stat cards, today's attendance, top products), `/admin/products`
(a new product from `admin`/`co_admin` submits for Super Admin approval
instead of publishing — see "Product creation approval gate" above; delete
button is role-aware — hidden for `admin`, "Request deletion" for
`co_admin`, "Delete" for `super_admin`, see "Product deletion" above),
`/admin/categories`, `/admin/orders` (includes an "Assign Delivery Agent"
picker on orders that are `ready_for_dispatch`/`delivery_failed` — see
"Order status pipeline & delivery" above), `/admin/refunds` (Order Manager
review + Admin/Super Admin approval — see "Finance module" above),
`/admin/coupons` (reachable by `co_admin` now too — large-discount
create/update requests may come back as a pending-approval notice instead
of an immediate save), `/admin/customers`, `/admin/reviews`,
`/admin/employees` (each staff row has an **Access** action — assign a custom role, review the person's effective permissions), `/admin/roles` (Roles & Permissions management — create/edit/delete custom roles, assign permissions; visible with `roles.view`, editable with `roles.manage`), `/admin/attendance`, `/admin/leave`, `/admin/tasks`,
`/admin/performance`, `/admin/salary` (nav-hidden from co_admin),
`/admin/inventory`, `/admin/purchases` (purchase batches + their fully
custom cost breakdowns — see "Purchasing: shops, batches & flexible landed
costs" above), `/admin/shops` (shops + per-staff shop assignment; the
assignment picker needs `shops.manage` — **not linked from `AdminNav`**,
since the project has no offline/physical shops in use beyond the one
seeded default; the page, route and API are unchanged and still reachable
directly by a `shops.manage`/`shops.view` holder, and the link can be
restored with no other change once multiple shops are actually in use),
`/admin/reports`, `/admin/finance` (revenue/expense/
investment/profit-loss summary, nav-hidden from co_admin),
`/admin/investments` (nav-hidden from co_admin), `/admin/expenses`
(reachable by co_admin — scoped to their own submissions), `/admin/approvals`
(Grant-Based Approval Workflow queue + threshold settings, `super_admin`
only), `/admin/audit-logs` (reachable by every admin-portal role plus
`order_manager` — scoped server-side to own actions for everyone except
admin/super_admin), `/admin/homepage` (hero slides + homepage sections —
**reachable by co_admin**, who can create/update slides and sections but not
delete them), `/admin/navigation` (header nav links —
nav-hidden from co_admin), `/admin/footer` (footer link columns — nav-hidden
from co_admin), `/admin/pages` (About/Contact/Shipping Policy body copy —
nav-hidden from co_admin), `/admin/settings` (site settings, including
social links — nav-hidden from co_admin), `/admin/profile` (avatar, contact
details, password, two-factor authentication, and address — reachable by
**every** admin-portal role including `order_manager`/`co_admin`, since it's
only ever scoped to the caller's own account; reuses the same
`ProfileSection`/`AddressBook` components as the Employee and Delivery
portals rather than a parallel implementation). `order_manager`'s nav
(`AdminNav.tsx`) is explicitly restricted to `Dashboard`, `Orders`,
`Refunds`, `Audit Logs`, and `Profile` — every other item declares an
explicit `roles`
list that excludes it — so an Order Manager reaches the same `/admin` shell
as everyone else but sees a much smaller nav; the real boundary is still
backend `authorize()`.

**Co-admin admin-portal UX**: the layout's `RoleGuard` (`app/admin/layout.tsx`)
accepts the whole `["co_admin","order_manager","admin","super_admin"]` union
— it's a role gate, not a per-page one — so a co_admin who navigates
directly to `/admin/salary`, `/admin/finance`, `/admin/investments`,
`/admin/navigation`, `/admin/footer`, or `/admin/pages` still reaches the
page shell (`AdminNav.tsx` only hides the link, it doesn't block the
route). Each of those pages handles this itself with a page-level check —
`const isRestricted = user?.role === "co_admin"` — that renders a friendly
`EmptyState` ("Access restricted... available to Admin and Super Admin
only") instead of attempting to load data, rather than letting the page
render its normal shell and have every API call inside it 403. This is UX
polish on top of the backend's real authorization boundary (those routes
already reject co_admin server-side) — not a substitute for it, and not a
security fix, since the API was never reachable by co_admin in the first
place. **`/admin/coupons` is no longer on this restricted list** — co_admin
has real, working (if discount-size-gated) access to it now, unlike the
other pages here which remain fully blocked. **`/admin/settings` is a
special case, not fully blocked or fully open**: its page-level check keys
off permissions rather than role (`canManageSettings =
hasPermission("settings.manage")`, `canManageLogo =
hasPermission("content.branding.manage")`) — co_admin holds only the
narrower `content.branding.manage`, so it reaches the page and gets
`BrandingLogoForm` (logo upload only, posting to `PATCH
/site-settings/logo`) instead of the full `SiteSettingsForm` (site name,
announcement strip, contact, footer, social links — still `settings.manage`
only, still admin/super_admin). See "Storefront header" below for why the
logo specifically was carved out.
`/admin/approvals` follows the same page-level-guard pattern but with a
narrower audience: its check is `user?.role !== "super_admin"` (not just
`=== "co_admin"`), since the backing routes (`/pending-actions`,
`/approval-settings`) are `super_admin`-only — an `admin` who navigates
there directly sees the same "Access restricted... Super Admin only" state
as a co_admin would, correctly reflecting that Admin has no role in the
Grant-Based Approval Workflow's review step.

#### Employee portal (`app/employee`) — fully built, not stubbed

Guarded by `RoleGuard allowed={["employee"]}` in `app/employee/layout.tsx`:
`/employee` (dashboard), `/employee/attendance` (check-in/out + history),
`/employee/tasks` (a `type` filter dropdown plus a type badge on each task,
alongside the existing priority badge/status dropdown), `/employee/stock`
(read-only live per-variant stock with a search box, backed by `GET
/inventory/stock` — supports the `stock_checking`/`warehouse` task types;
the same live numbers the storefront shows, with a "Stock Out" badge at
zero, and no way to change them from here), `/employee/leave`,
`/employee/performance`, `/employee/salary`, `/employee/profile` (avatar +
address — the `ProfileSection`/`AddressBook` components were already
generic/backend-supported for every role, this page just adds the missing
nav entry + route for staff).

#### Delivery portal (`app/delivery`) — fully built, not stubbed

Guarded by `RoleGuard allowed={["delivery_agent"]}` in
`app/delivery/layout.tsx`, built directly from the Employee portal's shell
pattern (same sidebar/mobile-drawer structure, `DeliveryNav.tsx` mirrors
`EmployeeNav.tsx`): `/delivery` (dashboard — assigned-order counts by
status), `/delivery/orders` (assigned-orders list + a detail modal with
Picked-Up/Out-for-Delivery actions, an OTP-entry field with a "Resend code"
link, and a Delivery-Failed form requiring a `failureReason`),
`/delivery/profile` (avatar + address, same as Employee's). See "Order
status pipeline & delivery" above for the full backend-driven workflow this
portal exposes. `delivery_agent` is not in `ADMIN_PORTAL_ROLES` and cannot
reach `/admin` — this is a structural guarantee (the role guard rejects it),
not just a hidden nav link.

**Data flow convention**: never fetch raw API shapes directly in a component.
Call the relevant `lib/api/*.ts` function, then map through `lib/mappers.ts`
(`toProduct`, `toCategory`, `toCustomerReview`) before handing data to a
component. This keeps components decoupled from Mongo's `_id`/populated-ref
shapes.

**Auth**: `AuthContext` hydrates from `GET /auth/me` on mount (cookie-based,
`credentials: "include"` on every request — set in `lib/api/client.ts`).
`status` is `"loading" | "authenticated" | "unauthenticated"`. Admin/
Employee/Delivery routes are guarded **client-side only** via
`components/admin/RoleGuard.tsx` (checks `useAuth()`, shows a loading
placeholder, then redirects to `/account` if unauthenticated or the role
doesn't match) — **there is no `frontend/src/middleware.ts`**; the guard is
UX-only (avoids a flash of admin UI), and the API enforces the real
authorization server-side.

**Silent access-token refresh** (`lib/api/client.ts`): the shared `request()`
helper behind every `api.get/post/patch/delete/postForm/patchForm` call
transparently handles the access-token cookie expiring mid-session
(`JWT_ACCESS_EXPIRES_IN`, 15 minutes by default) — a 401 on any endpoint
other than the auth ones that are 401-by-design (login, register, google,
refresh itself, logout, forgot/reset-password, verify-email/
resend-verification) triggers one `POST /auth/refresh` and, if that
succeeds, a single retry of the original request; concurrent 401s across
multiple in-flight requests share one refresh call instead of each firing
their own. Only when the refresh itself fails does `AuthContext` drop out of
its signed-in state — via `setAuthFailureHandler()`, a small callback
registry `client.ts` exposes so `AuthContext` can react immediately instead
of waiting for its next `GET /auth/me` poll. A session that sits open past
the access-token TTL now survives transparently instead of 401ing the next
mutating request (e.g. placing an order) and silently signing the user out
— confirmed live: registered a customer with a temporarily-shortened
`JWT_ACCESS_EXPIRES_IN=5s`, waited past expiry, and the next request
(`GET /auth/me`) 401'd, silently refreshed, and retried successfully with no
redirect to sign-in.

**Session lifetime is capped at 15 days.** `JWT_REFRESH_EXPIRES_IN` and
`utils/cookies.ts#REFRESH_TOKEN_MAX_AGE_MS` are both **15 days** (they must
stay in sync — the JWT expiry and the cookie `maxAge` are set independently,
so changing one without the other silently breaks the cap in one direction
or the other). Past that the refresh call itself fails and a real login is
required; the silent-refresh loop above cannot extend a session
indefinitely. Staff sessions additionally die after 30 minutes of inactivity
— see "Security hardening" above. While a Super Admin is impersonating, the
client sends an `Authorization: Bearer` token instead of relying on cookies
and skips the refresh path entirely (an impersonation token is not
refreshable); a 401 on it just clears the token so the next request falls
back to the Super Admin's own cookie session.

**Cart & wishlist are client-side only**: `CartContext` and `WishlistContext`
persist to `localStorage` (`sap:cart`, `sap:wishlist` keys) and resolve full
product data via `useProductsByIds`. They are **not** synced to the backend
or tied to the logged-in account — a cart/wishlist doesn't follow a customer
across devices or browsers, and is lost if `localStorage` is cleared. There
is no server-side cart/wishlist model. Keep this in mind before promising
cross-device persistence.

**Shop filter sidebar** (`components/shop/FilterSidebar.tsx`, state in
`components/shop/types.ts#ShopFilters`, applied in `ShopPageClient.tsx`):
a left panel of bordered facet sections — Price (dual-handle range slider),
Categories, Origin, Product Flags, Availability — plus a "Clear (n)" reset.
It collapses into a drawer below `lg`.

**Price** is a `PriceRangeSlider`: two overlaid native `<input type="range">`
on one track (no new dependency — the project carries no UI/form library).
It is fully controlled off `filters.minPrice`/`maxPrice`, so dragging filters
the grid live and there is **no Apply button**; keeping no local drag state
is also why "Clear" resets the handles for free. A handle on its end stop
reports `null` rather than the bound, so a full-range slider counts as "no
price filter" in the Clear tally. Handles clamp against each other and can't
cross. End stops come from the catalogue (`priceBounds` in `ShopPageClient`,
rounded outward to 50 BDT) and are derived from *all* products, not the
filtered subset — otherwise the track would shrink under the cursor
mid-drag. Thumb styling lives in `globals.css` under `.range-thumb`
(duplicated per engine: `::-webkit-slider-thumb` and `::-moz-range-thumb`
can't share a selector list).

There is **no Rating facet** (removed on request) — "Highest Rated" survives
as a *sort* option in `SortBar`, which is a separate control.

There is **deliberately no search box in the sidebar**: the header's search
bar already covers it, and a second input was redundant clutter.
`ShopFilters.query` still exists and is still applied — it's populated from
`?q=` by `ShopPageClient` — so don't remove the query filtering logic just
because no sidebar control sets it. The Price inputs are uncontrolled
(`defaultValue`), so `PriceFilter` is given a `key` derived from the applied
range; that remounts and clears the boxes when the range is reset from
outside the form (notably "Clear"), which otherwise left them displaying a
range that was no longer being applied.

All facets compose as AND — `filtered` in `ShopPageClient` narrows one
`list` through each active filter in turn. Filtering is client-side over the
products already fetched (`useProducts({ limit: 100 })`); price compares
against `variants[0].priceBDT`, which is the price the card actually
displays.

**Every facet must be backed by a field the `Product` model actually
stores.** There is deliberately **no "Brands" facet**: the model has no
brand field, so `origin` (a required string, e.g. "Madinah, Saudi Arabia")
stands in for it. Origin and Product-Flag options are *derived from the
loaded products* rather than hardcoded, computed over all products (not the
filtered subset) so choosing one option doesn't make the others vanish; the
Origin section hides itself when the catalogue has fewer than two distinct
origins, since a one-option facet can only be a no-op. Product Flags maps to
the `badge` enum (`Authentic`/`Best Seller`/`New`/`Limited`) plus "On Sale",
which is computed from `compareAtPriceBDT` rather than being a badge value.
Filtering is client-side over the products already fetched — don't add a
facet without a real field behind it.

**Storefront header** (`components/layout/Header.tsx`): two rows, in the
shape common to Bangladeshi storefronts (ghorerbazar.com was the reference
for the structure only — palette, type and components are this project's).
Row 1 is logo | `HeaderSearchBar` | labelled action icons (Track Order,
Wishlist, Cart with its count badge, account) + `ThemeToggle`; each action
carries its own text label rather than standing alone as a glyph. Row 2 is
the admin-managed `NavLink` list plus the Categories dropdown. Below `lg`
the nav row collapses into a **left-hand** drawer (hamburger sits on the
left, drawer uses `animate-slide-in-left`), and the search bar drops to its
own row. `HeaderSearchBar` submits to `/shop?q=…`, which `ShopPageClient`
already reads — no new endpoint or search page; the richer live-results
`SearchOverlay` still opens from the compact search icon on small screens.

**Sticky-on-scroll behaviour is pure CSS (`position: sticky`), deliberately
not scroll-event-driven JS.** At `lg`+, row 1 is plain normal-flow content
(`lg:static`) — it scrolls away naturally as the page scrolls, and row 2
(`sticky top-0 z-50`) takes over as the pinned nav once row 1 has scrolled
past. Below `lg`, row 2 doesn't render at all (nav links live in the
drawer instead), so row 1 itself is the one that's `sticky top-0` there,
and only the separate mobile search row (its own plain block below row 1)
scrolls away normally underneath it. Scrolling back up reveals row 1 again
exactly when its ordinary document position comes back into view — no
JS, no state, nothing to animate, so there's no scroll-vs-animation race to
cause jitter.

The one non-obvious requirement this depends on: **`<header>` itself must
be `display: contents`, not a normal block.** A `position: sticky`
descendant's containing block is its nearest block-container ancestor
*regardless of that ancestor's own `position`* (this "positioned ancestor"
requirement only applies to `absolute`/`fixed`) — so an ordinary `<header>`
wrapping both rows would silently cap how far either sticky row can
travel to header's own short (~120px) box, un-sticking the instant the
page scrolls past it, which is a real, easy-to-reintroduce regression that
looks fine at the very top of the page and only breaks once you scroll
further. `display: contents` removes header's own box (so its children's
containing block becomes `<body>`, which spans the whole page) while
keeping `<header>` in the accessibility tree as a landmark. Don't reintroduce
a plain `<header className="...">` wrapper around the two rows without
re-verifying this.

**Row 2 is a fixed premium emerald/gold bar — a deliberate exception to
site-wide dark mode.** `navLinkClass()` styles each link as a rounded-full
pill on a `bg-navbar-secondary` (`#003b2f`) bar: `text-on-navbar-secondary`
(`#f5f1e6`) normally, `hover:bg-navbar-secondary-hover` (`#0e5843`) +
`hover:text-navbar-secondary-active` on hover, and
`bg-navbar-secondary-active` (`#d4af37`) + `text-on-gold` for the active
page — all on a `duration-200 ease-in-out` color transition. These four
`navbar-secondary*` tokens (`globals.css`) are CONSTANT across themes, same
as `brand-deep-*`/`on-brand`: this bar does not follow the light/dark
toggle, by design. Below `lg`, where row 2 itself is `lg:hidden`, the same
treatment is mirrored in the mobile drawer via `mobileNavLinkClass()` — each
of `NavLink` + Categories becomes its own small emerald/gold pill on the
drawer's cream background, so mobile stays visually tied to the desktop
bar. Every other drawer row (Track Order, Wishlist, account, Sign Out) is
unrelated and still uses the original `MOBILE_ITEM_CLASS`. Only row 2 (and
its mobile-drawer mirror) uses this palette — row 1 and the Categories
dropdown's flyout panel are untouched and still follow the site-wide
light/dark theme.

**"More" dropdown** — the last item in row 2, right-aligned via `ml-auto`,
same hover + focus-within flyout pattern as the Categories dropdown beside
it (a cream `bg-cream-50` panel, not the emerald palette). Contains About
Us, Wishlist, FAQs, Call Us and WhatsApp — a **fixed structural menu**, the
same convention as the Categories dropdown itself (see its own comment
above): there is no dropdown/grouping concept in the `NavLink` admin model
(one flat link per row), so this isn't admin-editable, only its content is
data-driven. Mirrored into the mobile drawer as flat rows using the
unrelated `MOBILE_ITEM_CLASS` (About Us/FAQs/Call Us/WhatsApp — Wishlist is
already a drawer row on its own). Call Us (`tel:`) and WhatsApp (`wa.me`,
with a pre-filled generic greeting) both read `SiteSettings.contactPhone` —
edited at `/admin/settings`, the same field the Contact page already
shows — through `lib/phone.ts`'s `toTelHref`/`toWhatsAppHref`, which treat a
bare local number (leading `0`) as Bangladeshi and prefix country code
`880`; both menu items simply don't render (desktop) or render disabled
(product page buttons, see below) when `contactPhone` is blank, the same
graceful-degrade convention as the announcement strip and Google Sign-In.

**The logo is the only branding in row 1 — there is no "Saudi Authentic
Product" site-name text next to it.** It renders `SiteSettings.logo.url`
(`next/image`, intrinsic `2080×756`, `h-11 w-auto sm:h-12 lg:h-14
object-contain` so it scales without distortion at any breakpoint) with a
day-one static fallback at `client/public/images/branding/logo2.png` (a
transparent PNG) for a fresh install before anyone has uploaded one — the
fallback is never preferred over a configured logo. Changing it is a Site Settings action
(`SiteSettingsForm`/`BrandingLogoForm` on `/admin/settings`, `PATCH
/site-settings/logo`), reachable by `admin`/`super_admin` (via
`settings.manage`, same as the rest of site settings) and **also
`co_admin`**, via the narrower `content.branding.manage` permission — a
deliberate carve-out from the "co_admin can't reach site settings" rule
above, scoped to just the logo field so the rest of site settings
(name/announcement/contact/footer/social links) stays admin/super-admin
only. A change applies across the storefront on the next page load, no
redeploy — the header always reads the live `SiteSettings` document, never
a hardcoded image path.

A signed-in user is shown as `components/ui/UserAvatar.tsx` — their uploaded
`avatar.url` if they have one, otherwise a circular monogram of the first
letter of their name — rather than as a name string. The same component is
used in the admin, employee and delivery portal shells so every role gets
identical treatment.

**"Sign In" is the single auth entry point** — there is deliberately no
separate "Sign Up" button in the header or the mobile drawer. Registration
is reached from `AuthForms` itself, which offers both a Sign In / Register
tab bar and a "Don't have an account? Sign up" link below the form (and its
mirror, "Already have an account? Sign in"). `/account?tab=register` still
opens straight onto the register step, so existing links to it keep working.

**Product cards** (`components/ui/ProductCard.tsx`, and the offers page's
own card markup) show image + title + price + rating + add-to-cart + badges
only. The `tagline` is deliberately **not** rendered on cards — it still
feeds search matching and the product page's metadata description. Card
images sit in a fixed `aspect-[4/3]` box and pass `fit="cover"` to
`ProductMedia`, overriding its per-source default, so every tile in a grid
is identically shaped regardless of whether the image is an uploaded
Cloudinary photo or a curated local fallback.

**Product detail page gallery** (`components/product/ProductGallery.tsx`):
a real photo per `Product.images[]` entry renders as a thumbnail strip
**below** the main image (`grid-cols-4`); clicking one swaps the main
image. Hovering the main image (a real photo only — never the decorative
`ProductVisual` fallback) applies a cursor-following 2x magnify: an inner
wrapper around `ProductMedia` is scaled via inline `transform`/
`transformOrigin` computed from the pointer position, with the outer box's
`overflow-hidden` clipping it — `ProductMedia` itself is untouched (it's
shared by cards/cart/checkout/search, so the zoom stays local to the
gallery rather than becoming a prop every consumer has to think about). A
`ZoomIn` icon badge fades in over the top-right corner on hover (`group`/
`group-hover`, `pointer-events-none` so it doesn't add a second click
target), and the whole main-image area is a `<button>` (not a `div` with an
`onClick`, for native keyboard focus/Enter-Space support) that opens a
**fullscreen lightbox** — a separate `ImageLightbox` function in the same
file, `fixed inset-0 z-[110]` above everything else in the app (the mobile
nav drawer is `z-[90]`, `SearchOverlay` is `z-[70]`). It follows the same
"backdrop `<button>` behind, content as a DOM sibling" pattern
`SearchOverlay` uses for click-outside-to-close (no `stopPropagation`
needed — clicks on the backdrop button close it, clicks on sibling content
don't bubble to it) — the one thing to get right is that the image's own
wrapper must be `pointer-events-auto` (not inherit the centering flex
wrapper's `pointer-events-none`), or a click directly on the image falls
through to the backdrop underneath and closes the lightbox, which is the
opposite of "click outside closes it, click the image doesn't." Escape and
arrow-left/right are handled via a `keydown` listener scoped to while the
lightbox is open; previous/next arrows and a bottom thumbnail strip only
render `when images.length > 1`. Backdrop is `bg-black/95` rather than the
brand's green scrim used elsewhere (mobile drawer, etc.) — a colored
backdrop would visibly shift how the product photo's own colors read, which
defeats the point of a detail/zoom view meant to show the product
accurately. The enlarged image uses `object-contain` (never `cover`) so it
is never cropped or distorted.

**Product gallery editing** (`ProductForm.tsx`, part of the existing
`/products` create/update endpoint — see the routes table above, no
separate upload system): the admin form round-trips the current gallery as
`existingImages` (JSON, `{url, publicId}[]`) alongside any newly selected
files. `product.service.ts#updateProduct` keeps only the images whose
`publicId` is still present in `existingImages` (identity matched
strictly, same "no grafting a foreign id/publicId in" rule as variant
`_id`s — see "Variant identity across edits" above), in the order given,
deletes whatever was dropped from Cloudinary, and appends newly uploaded
files after — so one save can add, remove and reorder existing photos
without re-uploading the whole gallery, capped at 6 total. Sending no
`existingImages` at all (an older caller) falls back to the previous
wholesale-replace behaviour. The admin form's thumbnail strip shows a
remove (✕) and move-left/right control per existing photo on hover, plus a
separate "add more" file input that appends rather than replaces.

**Product page purchase actions** (`components/product/ProductInfo.tsx`):
four buttons in a 2x2 grid (same at every breakpoint) — Add to Cart, Buy
Now, Order on WhatsApp, Call for Order — using four new `Button` variants
(`cart`/`buyNow`/`whatsapp`/`call`) whose colors come from `globals.css`'s
CONSTANT `--color-action-*` tokens (not theme-swapped, same reasoning as
`navbar-secondary*`). Add to Cart runs a brief local
`"idle"→"adding"→"added"` sequence (not a real network call — cart is
`localStorage`, see "Cart & wishlist are client-side only" below — this is
purely the requested "Adding…/Added" button feedback) and is guarded
against double-firing while non-idle; the cart drawer opening
(`CartContext#addItem` already does this) is the actual "added" signal.
Buy Now adds to cart then routes to `/checkout` — there is no separate
direct-checkout path, since checkout already reads from the cart. WhatsApp
and Call read `SiteSettings.contactPhone` exactly like the header's "More"
menu (see "Storefront header" above) and render disabled with a title
tooltip when it's blank, rather than being omitted, so the grid stays 2x2.
The WhatsApp message is generated from the live product/variant/quantity —
never hardcoded. Both purchase buttons (not WhatsApp/Call, which are
inquiry channels) disable when the selected variant's stock is 0. The
Button component's shared base class was split so shape (radius/casing/
transition duration) lives per-variant instead of in the common base — a
base-level utility and a variant-level override of the same CSS property
landing on one element is unreliable to resolve by class-string order (see
`Button.tsx`'s comment), so the four new variants own their radius/casing/
timing outright rather than fighting the older four's defaults.

**Images**: real Cloudinary photos render via `next/image` when
`product.images.length > 0` / `category.image` is set; otherwise components
fall back to `<ProductVisual>` (a deterministic decorative gradient+icon
computed by `lib/mappers.ts#getFallbackVisual(seed)` from the slug — same
seed always produces the same tone/icon, so it doesn't visually "flicker"
between renders).

**Fetching freshness**: `lib/api/client.ts` sets `cache: "no-store"` on every
request — product/order/inventory data changes live via the admin portal, so
nothing should ever serve a stale cached response (client or Next.js
server-fetch cache). Pages with server-side data fetching set
`export const dynamic = "force-dynamic"` for the same reason — this app has
no meaningfully static pages once wired to a live backend.

**Design tokens** (`app/globals.css`, Tailwind v4 `@theme`, no
`tailwind.config.js`): cream (`cream-50..400`), green (`green-950/900/800`),
gold (`gold-500/600/700`), brown (`brown-500/600/700`), ink (`ink-900`),
plus `surface`/`surface-muted`, `navbar`/`navbar-inner`, `hairline`, the
status accents (`danger`/`danger-strong`/`danger-soft`/`danger-border`,
`gold-soft`, `success-soft`, `warning-soft`), and the theme-constant
`brand-deep`/`brand-deep-2`/`brand-deep-3`/`on-brand`/`on-gold`/
`danger-solid`/`visual-*`.
Fonts: EB Garamond (`font-serif`, headings) + Plus Jakarta Sans (`font-sans`,
body) — self-hosted via `@fontsource/*` packages imported in `app/layout.tsx`
(not `next/font`). Reuse `cn()` and `formatBDT()` from `lib/utils.ts` and the
primitives in `components/ui/` — don't hand-roll new buttons/cards/headings.

**Dark mode** (`context/ThemeContext.tsx`, `components/ui/ThemeToggle.tsx`):
site-wide — storefront *and* the admin/employee/delivery portals — driven by
a single `data-theme="dark"` attribute on `<html>`. It works by
**redefining the palette variables** under `[data-theme="dark"]` in
`globals.css`, not by adding `dark:` variants across ~140 components. Two
consequences to respect:

- `@theme` must **not** be `inline`. `inline` bakes literal colors into every
  utility, which can then never be overridden at runtime; plain `@theme`
  emits `var(--color-*)` so a scoped redefinition flips the whole app.
- The tokens are **role**-based, not literal. `cream-*` means "page/surface
  background" (light in light mode, near-black in dark) and `green-*` means
  "foreground text/dark accent" (inverts to light in dark). So: use
  `text-green-950` for dark text, but **`bg-brand-deep` — never
  `bg-green-950` — for a deliberately dark surface** (primary buttons,
  footer, panel headers, the hero scrim), with `text-on-brand` for the light
  text on it. Those four `brand-*` tokens are deliberately *not* overridden
  in dark mode. Solid card backgrounds use `bg-surface`, never `bg-white`
  (a literal white can't flip); translucent `bg-white/N` overlays sitting on
  top of images or dark surfaces are fine as-is.

**Status accents are tokens, not hex literals.** `danger` / `danger-strong`
/ `danger-soft` / `danger-border`, `gold-soft`, `success-soft`,
`warning-soft` replaced ~230 raw `[#8a4a3f]`-style values. A `*-soft`
background always carries its matching foreground (`danger-soft` + `danger`,
`gold-soft` + `gold-700`, `success-soft` + `green-900`) so both halves invert
together and the contrast ratio is preserved by construction rather than by
luck. Several families are deliberately **constant** across themes:
`brand-deep-*`/`on-brand`, `danger-solid` (a filled badge that always carries
white text), `on-gold` (text on a gold fill — gold stays light in both
themes, so `text-green-950` there inverted to near-white and dropped the CTA
to 1.6:1), `visual-*` (ProductVisual's five decorative gradients, which
stand in for photography and shouldn't recolour), `navbar-secondary*`
(the header's second-row nav bar — see "Storefront header" above),
`action-*` (the product page's four purchase buttons — see "Product page
purchase actions" above), and `cart-soft`/`cart-liquid` (the product-card
grid's "Add to Cart" button, see below). There
should be **no arbitrary hex left in any `.tsx`** — add a token instead.

**Product cards' "Add to Cart" button** (`Button.tsx`'s `addToCart`
variant, used by `ProductCard.tsx` and `shop/AddToCartButton.tsx` — the
`/offers` page's own card markup) has a **liquid/water-fill hover effect**
instead of a flat color swap: `bg-cart-soft` (a lighter, softer green than
the plain `primary` variant's `bg-brand-deep-2`) at rest, with a
`before:` pseudo-element as the "liquid" — full width, anchored to the
bottom via `[transform-origin:bottom]`, scaled to 0 height at rest and
grown to full height (`bg-cart-liquid` — a shade *darker* than `cart-soft`,
chosen over a lighter fill for cleaner, more noticeable contrast) on hover
over `duration-300`. CSS
transforms don't affect the box model, so the pseudo-element's
`border-radius: 50% 50% 0 0 / 10px 10px 0 0` (a shallow dome across the
*whole* top edge, not just rounded corners — the "wave") stays crisp as it
scales. `before:-z-10` is required: a plain, non-positioned child (the
button's own icon/text) would otherwise render *behind* a `position:
absolute` pseudo-element by default, hiding it; `isolate` on the button
keeps that negative z-index scoped locally rather than leaking into the
page's stacking order. `relative overflow-hidden rounded-full` on the
button clips the fill layer to the pill shape. The reverse
(`scale-y-100` → `scale-y-0`) plays automatically on mouse-leave via the
same transition — nothing extra needed for "the liquid recedes smoothly."

Preference is persisted in `localStorage` under `sap:theme`. **The default
for a visitor with no saved preference is always Light — deliberately not
the OS `prefers-color-scheme`,** so a device set to system dark mode still
opens the app in Light on a first visit; the toggle still works normally
from there and the choice is remembered like any other saved preference. An
inline pre-hydration script in `app/layout.tsx` applies a saved `dark`/
`light` value to `<html>` before first paint (the `<html>` tag itself
already carries `data-theme="light"` as its static default, so the script
only needs to act when a saved preference actually overrides that) — this
is what gives a returning dark-mode visitor no white flash, and what keeps
a fresh visitor from ever flashing into dark before settling on light; its
storage key must stay in sync with `THEME_STORAGE_KEY`. `ThemeToggle`
renders both its icons and lets CSS (`.icon-when-light` / `.icon-when-dark`)
pick one, so nothing renders from theme state and there is no hydration
mismatch.

**Product grid columns** — two shared scales in `lib/utils.ts`, so
breakpoints can't drift page to page. `PRODUCT_GRID_CLASS` (offers, wishlist,
related products): 2 → 3 → 4 → 5 columns at base/`sm`/`lg`/`xl`.
`SHOP_GRID_CLASS` (shop page and its skeleton): one column narrower at every
step above the floor — 2 → 2 → 3 → 4 — because the shop gives up width to
its filter sidebar. **Both never drop below 2 columns**, including on small
phones. Shop `PAGE_SIZE` is 20, which divides evenly by 2/3/4/5 so a full
page never ends in an orphaned part-row. The homepage's own product rails
(`BestSellers`, `ProductShowcase`) don't use `PRODUCT_GRID_CLASS` — they use
`ProductCarousel` instead (see below), which mirrors the same 2/3/4/5 column
counts as a per-card width rather than a CSS grid.

**`ProductCarousel`** (`components/ui/ProductCarousel.tsx`) — the sliding
product rail every homepage product section (`BestSellers`,
`ProductShowcase`, for Best Sellers plus every category/new-arrivals/on-sale
showcase configured in `/admin/homepage`) renders through, replacing what
used to be a static `PRODUCT_GRID_CLASS` grid. Since it's one shared
component, every section using it behaves identically — there's no
per-section carousel logic to keep in sync. **Deliberately no visible
prev/next arrow buttons** — built and then removed on request because they
read as clutter on the homepage. Manual navigation is native touch swipe,
click-and-drag with a mouse, and a row of dot buttons below the track;
left alone, it autoplays too (`AUTOPLAY_MS`, paused on hover/focus/drag).
Only the homepage rails use this; `/shop`, `/offers`, `/wishlist` and
related-products still use the static `PRODUCT_GRID_CLASS`/`SHOP_GRID_CLASS`
grids.

**It's a bounded single-card sliding window, not an infinite loop, and it
moves exactly one card per interaction — never a page/group, never a skip.**
`[1 2 3 4]` → drag → `[2 3 4 5]` → drag → `[3 4 5 6]`, one product at a
time, original order always preserved, never `[1 2 3 4]` → `[5 6 7 8]`. The
window's start index (`activeIndex`) is clamped to `[0, products.length -
visibleCount]` and simply stops at either end — `[5 6 7 8]` is the last
position for 8 products at 4-visible, and dragging or autoplaying further
does nothing rather than overshooting or leaving a gap. This is the
opposite of two earlier versions of this component: one that tripled the
product list to loop forever, and one that (briefly) moved a full page
(`visibleCount` cards) per interaction — both were deliberately removed.
Visible-card count (`VISIBLE_COUNT_BREAKPOINTS`, 2/3/4/5 by breakpoint,
mirroring `CARD_WIDTH_CLASS`) is unchanged by any of this — it only decides
how far the window can slide (`maxIndex`), not how far one interaction
moves it.

**Position is driven entirely by JS, through one function.** A single
`positionPxRef` (px) is the only source of truth for "where the track is,"
and autoplay ticks, dot clicks, and drag all funnel through the same
`applyPosition(px, opts)`, which clamps it into `[0, maxIndex * stepWidth]`,
writes the `transform`, and derives `activeIndex` from it. There is
deliberately no second code path that independently tracks position —
that's what keeps drag, autoplay, and the dots in sync with each other.

This does **not** use native horizontal scrolling (`overflow-x-auto` +
`scrollLeft`), which an earlier version of this component was built on.
That combination fought itself once a mouse-drag was layered on top: CSS
`scroll-snap` resisting a directly-assigned `scrollLeft` on every
`pointermove` (the slider felt like it was sticking), and
`element.setPointerCapture()` intermittently retargeting the
`pointerup`/`click` pair away from the `<ProductCard>` link under the
cursor (an ordinary click stopped opening the product page). Moving the
track with `transform` inside a plain `overflow-hidden` viewport sidesteps
both — there's no native scroll gesture for anything to fight. Reading the
live position when a drag starts is a `getComputedStyle` transform-matrix
parse (`getCurrentTranslateX`), not a scroll position the browser is also
trying to own, so grabbing the slider mid-animation continues smoothly from
where it visually is rather than snapping first.

One CSS pitfall worth flagging for any future change here: the track's
className is `w-full`, **not** `w-max`/`w-fit`. Each card's width
(`CARD_WIDTH_CLASS`) is a *percentage*, which can only resolve against a
track with a definite width — an earlier version sized the track to its
own (then tripled-list) content instead, leaving the percentages with
nothing to resolve against, and Chrome fell back to sizing every card near
the full container width. With `w-full` the track's own box is exactly one
viewport wide; its content still naturally overflows that box whenever
there are more than `visibleCount` products (`shrink-0` on every card, so
they never compress to fit), which is fine — `overflow-hidden` on the
viewport clips it for display.

Card width is measured once (on mount and on resize) into `stepWidthRef`
rather than re-measured with `getBoundingClientRect` on every drag frame —
that forces a synchronous layout, and doing that 60+ times a second during
a drag is what made an earlier version of this component feel laggy.

Mouse and touch share one code path via Pointer Events, listened on
`window` (not captured on the track — see the pointer-capture note above)
for the duration of an active drag, torn down together via an
`AbortController` created in the `pointerdown` handler rather than
`removeEventListener` with a stored function reference (which would need a
"latest callback" ref — this project's lint config, the React Compiler
rules, rejects mutating a ref outside a plain DOM-ref effect). The track
carries Tailwind's `touch-pan-y`, so a vertical touch gesture is left
entirely to the browser's native page scroll (delivered to this component
as a `pointercancel`, which ends the drag cleanly) while a horizontal one
is this component's to animate — the standard way to combine a horizontal
drag surface with a vertically-scrolling page. A capture-phase `click`
handler on the track swallows exactly the one click that follows a real
drag (tracked via a ref that flips once pointer movement exceeds
`DRAG_CLICK_THRESHOLD`, a small ~6px hair-trigger just for telling a click
from a drag), so a drag never accidentally opens the product page, while an
ordinary click — including one with a few pixels of the jitter any real
click has — still does.

**A drag always resolves to exactly the next or previous card, never a
partial one and never more than one.** While the pointer is down the track
follows it 1:1 (live, no easing) via the same `applyPosition`; on release,
`endDrag` compares the net displacement against `DRAG_COMMIT_RATIO` (15%)
of one *card's* width — short of that it springs back (animated) to the
card it started on, past it, it commits to exactly one card forward or
back in the drag's direction, regardless of how much further past the
ratio it was dragged. This two-tier threshold (`DRAG_CLICK_THRESHOLD` for
click-vs-drag, `DRAG_COMMIT_RATIO` for card-vs-spring-back) is why a small
accidental drag neither opens a product nor moves the slider.

The dot row has one dot per single-card position the window can stop at —
`products.length - visibleCount + 1` of them (5 dots for 8 products at
4-visible: positions `[1234] [2345] [3456] [4567] [5678]`), **not** one dot
per product and **not** grouped into pages — clicking one jumps straight to
that window position via the same `applyPosition` every other movement
goes through, so autoplay, a dot click, a drag, and a swipe all stay in
sync through one code path. Hidden entirely when every product already
fits on screen (`products.length <= visibleCount`), same as an earlier
page-based version of this dot row did. `visibleCount` is read via
`useSyncExternalStore` on `resize` (not `useEffect` + `setState`, which the
React Compiler lint rules reject) so the SSR snapshot (2, the base
breakpoint) matches the first client render with no hydration mismatch.

**No form or state-management library**: forms and data fetching are
hand-rolled with `useState`/`useEffect` + the custom `lib/api` client — no
react-hook-form, no SWR/React Query, no Redux/Zustand. Match this pattern for
new forms/pages rather than introducing a new library.

**Printable order invoice** (`components/order/OrderInvoice.tsx`): a
`PrintInvoiceButton` component — drop `<PrintInvoiceButton order={order} />`
next to any order's other actions — that opens a `Modal` containing a
plain black-on-white `InvoiceDocument` (company logo/name from the public
`GET /site-settings`, fetched lazily on first open; customer/shipping
details; itemized product table; subtotal/shipping/discount/total;
payment method and paid/unpaid status) plus a "Print" button that calls
`window.print()`. Print isolation is pure CSS: the document carries
`id="invoice-print-area"`, and a `@media print` rule in `globals.css`
hides everything else on the page (`visibility: hidden` on `body *`,
`visibility: visible` again on the invoice subtree, which is then
absolutely positioned to fill the page) — this works regardless of the
invoice being nested inside another modal (e.g. the admin order-detail
modal), since the rule targets the id globally rather than relying on DOM
position. Used by `/admin/orders`'s order-detail modal and the customer
account portal's `OrderHistory.tsx`. No PDF library — printing to PDF is
just the browser's own "Save as PDF" print-destination option.

**Reusable Confirm Dialog** (`context/ConfirmDialogContext.tsx`): replaces
every raw `window.confirm()` in the app (delete, reject, deny, deactivate,
cancel, support-login, and the stock-conflict warning on
`/admin/approvals`) with a styled, promise-based dialog consistent with the
rest of the admin UI — `window.confirm()`'s blocking, unstyled browser
prompt is also the thing that caused the refund-rejection bug below. Mounted
once as `<ConfirmDialogProvider>` in the root `app/layout.tsx`; any
component calls `const confirmDialog = useConfirm();` then
`const ok = await confirmDialog({ title, message, confirmLabel?,
cancelLabel?, tone? })` — `tone: "danger"` renders a warning icon and a
solid red confirm button (`Button`'s `danger` variant), anything else
renders a plain primary button. **Do not reintroduce `window.confirm()` or
`window.prompt()`-then-proceed-unconditionally** — the latter was a real bug
on `/admin/refunds`' Reject action (and, identically, on `/admin/approvals`'
Grant/Deny, `/admin/expenses`' Reject, and `/employee/leave`'s Cancel):
`prompt()` returns `null` on Cancel and `""` on an empty-but-confirmed
input, and code that did `prompt(...) ?? undefined` treated both the same,
so cancelling the "reason" prompt still rejected/denied/cancelled the
underlying record. Every `prompt()`-for-an-optional-note call site in the
codebase now explicitly checks `=== null` before proceeding.

**Consistent CRUD action colors**: `globals.css` defines a role-based
(not literal-hex) color system for row-level actions, mirroring the
existing `danger`/`success-soft` pattern — `--color-info`/`-strong`/`-soft`/
`-soft-hover` (blue, new) for Edit/Update, `--color-danger`/`-soft`/
`-soft-hover` (red, pre-existing) for Delete/Reject/Deny, and the
pre-existing `green-900`/`success-soft`/`-soft-hover` (green) for
Approve/Grant/Confirm. Every one of these is a **pill-shaped chip with a
visible background at rest** — `inline-flex items-center rounded-full px-3
py-1 ... bg-<color>-soft text-<color> hover:bg-<color>-soft-hover
transition-colors duration-150 cursor-pointer` for a text-label action, or
the same with `justify-center p-1.5` in place of `px-3 py-1` for an
icon-only one — never bare colored text with no background. `Button.tsx`
also gained a `danger` variant (`bg-danger-solid text-white
hover:brightness-90`) for full-size buttons (the Confirm Dialog's destructive
button, "Delete" on `/admin/purchases`, "Deactivate"/"Reject" on
`/admin/customers`/`/admin/refunds`). Icon-only action buttons are also
wrapped in `components/ui/Tooltip.tsx` (`<Tooltip label="Edit">...`) — a
pure-CSS hover/focus-reveal label that sits alongside, not instead of, the
button's own `aria-label`.

This is applied project-wide, not just inside `/admin` — every Edit/Delete/
Approve/Reject/Remove-style action across every portal follows the same
chip recipe: the admin CRUD tables (products, categories, coupons, roles,
reviews, tasks, attendance, leave review, expenses, purchases + their cost
editor, shops, employees, navigation/footer/homepage content management,
site settings' social links, static/homepage section blocks), and the
customer-facing/shared surfaces too — `components/account/AddressBook.tsx`
(shared by the customer account, employee, delivery and admin profile
pages, so one fix covers all four), `components/account/ProfileSection.tsx`'s
"Remove Photo", `components/layout/CartDrawer.tsx` and the standalone
`/cart` page's "Remove item", `components/checkout/CheckoutClient.tsx`'s
"Remove coupon", and the registration form's inline address section in
`components/account/AuthForms.tsx`. Reorder arrows (move up/down) keep a
neutral hover (`hover:bg-cream-300`) rather than a color, since they aren't
Edit/Delete/Approve; purely navigational or dismiss-style icons (nav links,
modal close buttons, the wishlist heart toggle) are deliberately left alone
— they're a different UI pattern, not a CRUD action on a record.

**Testing**: Vitest + React Testing Library (`vitest.config.mts`,
`vitest.setup.ts` — jsdom environment, `@/*` alias resolved to `src/`,
`@testing-library/jest-dom` matchers). `npm test` runs `vitest run`,
`npm run test:watch` for the interactive watcher. Coverage is intentionally
basic, not exhaustive: pure-logic unit tests (`lib/utils.test.ts`,
`lib/passwordStrength.test.ts`, `lib/mappers.test.ts`), component tests
(`components/ui/PasswordStrengthMeter.test.tsx`,
`components/order/OrderInvoice.test.tsx` — mocks `lib/api/siteSettings` and
asserts the opened invoice shows the order's items, address and totals), a
permission-filtering test for the admin sidebar (`components/admin/AdminNav.test.tsx` — mocks
`AuthContext` to assert that an Order Manager's menu is byte-identical to what
the old hardcoded role lists produced, that a custom marketing role gets its
own menu with no role name involved, and that a permission-less account sees
only Dashboard and Profile), and a context/hook test
(`context/CartContext.test.tsx`, mocking `lib/api/products` to verify
add/remove/quantity/localStorage-persistence logic without a real network
call). No Playwright/e2e browser testing exists — UI/visual changes still
need manual verification in a browser, see "For UI or frontend changes" in
the Doing Tasks guidance at the top of the harness system prompt.

## Environment / running locally

Both apps need `.env` (see `.env.example` in each). Already configured on
this machine: MongoDB Atlas, Cloudinary, SMTP.

```
backend:  npm run dev            (tsx watch, http://localhost:5000, API at /api/v1)
          npm run dev:dns-fix    (tsx watch + DNS preload — see below)
          npm run build          (tsc -> dist/)
          npm start              (runs dist/server.js + DNS preload — see below)
          npm run seed           (creates super admin + sample co_admin/employee accounts + categories + products + default homepage product-showcase sections)
          npm run typecheck / lint / test
frontend: npm run dev      (Next.js, http://localhost:3000)
          npm run build / start
          npm run typecheck / lint
```

`frontend/.env.example` documents `NEXT_PUBLIC_API_URL` (defaults to
`http://localhost:5000/api/v1` if unset — fine for local dev, matches the
backend's default `PORT`/`API_PREFIX`) and `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
(public, not secret — blank hides the "Continue with Google" button; must
match the backend's `GOOGLE_CLIENT_ID`).

`backend/.env.example` documents: `NODE_ENV`, `PORT`, `API_PREFIX`,
`CLIENT_ORIGIN` (CORS), `MONGODB_URI`, `JWT_ACCESS_SECRET` /
`JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN`,
`COOKIE_DOMAIN`, `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` /
`CLOUDINARY_API_SECRET`, `SMTP_SERVICE` / `SMTP_USER` / `SMTP_PASS` /
`SMTP_FROM`, `GOOGLE_CLIENT_ID` (Google Sign-In, see above), `SEED_SUPER_ADMIN_NAME` / `SEED_SUPER_ADMIN_EMAIL` /
`SEED_SUPER_ADMIN_PASSWORD`. All validated by a Zod schema in
`src/config/env.ts` — the app fails fast on startup if a required var
(JWT secrets, Mongo URI) is missing or malformed, except a relaxed default
for JWT secrets under `NODE_ENV=test`. Blank Cloudinary vars → upload
endpoints return a clear 503 (everything else still works); blank SMTP vars
→ email sending becomes a silent logged no-op (`isSmtpConfigured`); blank
`GOOGLE_CLIENT_ID` → `/auth/google` 503s and the frontend button hides itself
(`isGoogleConfigured`).

### Sandbox/local DNS workaround (`backend/scripts/`)

This dev machine's Node resolver reports `127.0.0.1` as its DNS server
instead of the real one (a stale/orphaned Windows network-adapter registry
entry — not an app, Atlas, or network problem), which breaks the
`mongodb+srv://` SRV lookups Mongoose needs with `querySrv ECONNREFUSED`,
even though normal DNS works fine otherwise. Three files, all explicitly
commented **TEMPORARY / DEVELOPMENT-ONLY**, work around it — **do not "fix"
this by changing `config/db.ts`, `server.ts`, or the database architecture**:

- **`dev-dns-preload.cjs`** — the actual fix: `dns.setServers(["8.8.8.8", "1.1.1.1"])`. Must run before any app code (via `require()` at the top of a launcher, or `-r` on `NODE_OPTIONS`) — stays outside `src/`, never imported from app code.
- **`dev-dns-fix.cjs`** — backs `npm run dev:dns-fix`; spawns `tsx watch src/server.ts` as a child process with `NODE_OPTIONS=-r <path-to-preload>` so the preload reaches the process tsx actually runs (not just the wrapper).
- **`start.cjs`** — backs `npm start`; `require()`s the preload then `require()`s `../dist/server.js` synchronously (so `dns.setServers()` completes before Mongoose ever connects), letting `npm start` work standalone with no manually-set `NODE_OPTIONS`.

Plain `npm run dev` does **not** load the preload — use `npm run dev:dns-fix`
instead if SRV lookups fail in watch mode. `npm run build` / `npm run
typecheck` / `npm test` are unaffected (no DB connection involved). If this
app is ever deployed to a host without this local DNS bug, `start.cjs` could
be simplified back to a plain `node dist/server.js` — but don't make that
change speculatively; only when someone confirms the target host doesn't
need it.

### Deployment routing (`client/vercel.json`)

The client deploys to Vercel as a **Next.js** app, so Vercel's own Next.js
builder owns routing — `client/vercel.json` therefore declares only
`"framework": "nextjs"` and must **not** contain SPA-style catch-all
rewrites.

It previously held `{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}`
— a single-page-app config (CRA/Vite style) that does not apply to Next.js:
`/index.html` is not part of a Next.js build output at all. A rewrite like
that is harmless for routes that resolve in Vercel's filesystem phase (the
homepage, `/shop`, `/offers`, every `/admin/*` page — all fixed paths), but
it swallows **parameterized dynamic routes**, which are matched later in the
routing pipeline. `/product/[slug]` is the only parameterized route in this
app, which is exactly why "clicking a product card errors" was the sole
visible symptom while the rest of the site worked. Don't reintroduce a
catch-all rewrite here.

## Coding rules

- Match the existing layered pattern exactly (see Architecture above) —
  don't introduce a different style for new resources.
- **Gate routes with `requirePermission("some.permission")`, not with a
  hardcoded role list.** This supersedes the previous "don't add a DB-backed
  permission system" rule, which described the codebase before the
  role-and-permission system existed. Add the new key to
  `constants/permissions.ts` (and to a `PERMISSION_GROUPS` entry so it shows
  up in the admin panel), mirror it in `client/src/lib/permissions.ts`, then
  reference it from the route. Roles are database rows and must never need a
  code change; permissions are code, because a permission no route consults
  grants nothing. `authorize(...)` still exists and still works — keep it
  only where the check really is about role identity rather than capability.
- Don't reintroduce `data/products.ts`-style mock data — the storefront is
  fully wired to the live API; everything comes from MongoDB now.
- Keep `lib/api/*.ts` functions thin (just the fetch call + types) — business
  logic belongs in the backend service layer, not the frontend API client.
- Never `await` an email send in a request path — always `void sendXEmail(...)`.
- When adding a new Express route that reads `req.query`, make sure it goes
  through `validate({ query: ... })` (which already applies the
  `Object.defineProperty` fix) rather than reading `req.query` raw.
- Don't call the homepage hero-slide/homepage-section system a general
  "CMS" or imply arbitrary pages/blocks are admin-editable — see "Homepage
  content management" above for exactly what it covers.
- `PendingAction`/`ApprovalSettings` are a workflow layered **on top of**
  permission gating for a specific, spec-defined list of high-risk actions.
  They answer "may this change take effect yet?", which is a different
  question from "may this person make it at all" — the permission check runs
  first and the approval gate second, and neither replaces the other. To gate
  a new action type: add it to
  `PENDING_ACTION_TYPES` (`models/PendingAction.model.ts`), register an
  apply-handler via `registerPendingActionHandler()` at the bottom of the
  owning service (never have `pendingAction.service.ts` import that service
  directly — see "Approval-gate system & audit logging"), and call
  `createPendingAction()` at the point where the gate should trigger. Any
  new Super-Admin-editable numeric threshold belongs on `ApprovalSettings`,
  never hardcoded.
- **Never add a fixed category/type enum to `Purchase.costItems[]`.** Cost
  names are free text so that any product's cost structure fits without a
  code change — see "Purchasing: shops, batches & flexible landed costs".
  The fixed-taxonomy model is `Expense.category`, which is a separate
  concern; don't merge the two or copy one's enum into the other.
- Any new read or write over `Purchase`/`Shop` must go through
  `shop.service.ts#resolveShopScope` (or `assertShopAccess`) rather than
  querying the collections directly — that single function is where the
  "Co-Admin only sees assigned shops" boundary lives, and it fails closed.
- Call `recordAuditLog()` (`services/auditLog.service.ts`) for any new
  sensitive action outside what `InventoryLog`/`Order.statusHistory` already
  cover (role/status changes, financial approvals, settings changes,
  create/update/delete on anything an owner shouldn't be able to silently
  undo) — it never throws, so it's always safe to call inline.

## Security

- Secrets live only in `.env` files (gitignored, never commit). Real
  MongoDB/Cloudinary/SMTP credentials are already configured — don't print,
  log, or echo their values.
- All mutating routes require `authenticate`; role-sensitive ones add
  `authorize(...)`. Every new route must follow the same pattern — no
  unauthenticated writes.
- Passwords are hashed via bcrypt in `User.model.ts`'s pre-save hook; never
  handle plaintext passwords outside that path.
- `sanitizeRequest` (NoSQL-injection stripping) and `hpp()` run globally in
  `app.ts` — don't bypass them for new routes.
- Cloudinary uploads go through `multer` memory storage with file-type/size
  limits already enforced in `middlewares/upload.middleware.ts` — reuse it
  rather than adding a parallel upload path.

## Known limitations (verified, not exhaustive)

- **The permission catalogue is code, not data.** Roles are database rows and
  need no code change, but a brand-new *permission* does: add it to
  `constants/permissions.ts`, mirror it in `client/src/lib/permissions.ts`,
  and reference it from a route. This is deliberate — a permission no route
  consults would grant nothing while appearing to grant something. It does
  mean the spec's illustrative `marketing.video.*` / `marketing.campaign.*` /
  `marketing.analytics.view` keys are **not** present: this codebase has no
  video, campaign or marketing-analytics feature to gate. A VIDEO_EDITOR role
  can still be created today from the panel; it would carry the marketing and
  content permissions that do exist.
- **The role cache is per-process.** `role.service.ts` caches role documents
  in memory and invalidates on write, so a permission edit applies on the very
  next request — on the instance that served the edit. A multi-instance
  deployment would see other instances keep the old permissions until their
  next restart. Single-instance deployments (the current Render setup) are
  unaffected.
- **A custom role adds permissions and cannot subtract them.** There is no
  per-user deny list and no way to give an Employee *fewer* permissions than
  their built-in role carries — narrowing means re-permissioning the built-in
  role itself, which affects everyone holding it.

- **Test coverage is basic, not comprehensive** — the backend has unit specs
  plus a small set of integration tests (auth, catalog, order, orderStatus,
  task) against an in-memory MongoDB, and the frontend has Vitest/RTL
  coverage for a handful of pure-logic modules, one component, and
  `CartContext` (see Testing in both Architecture sections above). Most
  routes/pages/components still have no automated test; UI/visual changes
  still need manual browser verification, and no Playwright/e2e browser
  testing exists.
- **No payment gateway integration** — `paymentMethod` (`cod`/`bkash`/
  `nagad`) is stored on the order but there is no `config/payment.ts`, no
  webhook/callback route, and no signature verification; `Order.isPaid` only
  ever flips to `true` for a `cod` order that reaches `delivered` (via either
  the generic status endpoint or the delivery-agent's OTP-verify flow — see
  "Order status pipeline & delivery" above) — a `bkash`/`nagad` order is
  never actually charged or marked paid by anything in this codebase, and the
  frontend checkout never redirects to a gateway. Treat "select bKash/Nagad
  at checkout" as UI-only until a real gateway (e.g. bKash/SSLCommerz) is
  integrated.
- **The approval-gate system covers a fixed, spec-defined list of actions**
  (`coupon.create`/`.update`, `product.create`, `product.delete`,
  `product.stock.update`, `inventory.adjust`, `refund.request`/`.approve`,
  `expense.confirm`, `purchase.receive`) — role
  changes, settings changes, product content edits, and other sensitive
  actions are audit-*logged* (see "Approval-gate system & audit logging"
  above) but are **not** routed through the Grant-Based Approval Workflow;
  only the nine action types above create a `PendingAction`.
- **A queued stock change is still not *locked* against concurrent edits** —
  two staff members can each queue a change to the same variant and both
  apply in grant order (`inventory.adjust` deltas compose correctly;
  `product.stock.update` carries absolute values, so it's last-grant-wins).
  The reviewer is now warned about the overlap before granting (see
  "Overlapping stock requests" above), but nothing blocks or auto-supersedes
  the second request — resolving it is a human decision.
- **2FA is opt-in per account and cannot be enforced or admin-reset** — there
  is no setting that requires it for staff roles, and no admin-side reset
  path if a user loses both their authenticator and all eight recovery codes
  (recovery is a manual database edit). See "Security hardening" above.
- **The idle-session timeout is per-user, not per-device** — it's driven by a
  single `User.lastSeenAt`, so activity in one browser keeps every session
  for that account alive. There is no session list and no per-device
  revocation beyond the existing all-sessions logout (`tokenVersion`).
- **Notification coverage is deliberately partial** — three operational
  events (new order, low stock, delivery failure) plus the approval-gate and
  transactional emails (see "Operational notifications" above). The rest of
  ROLES_AND_PERMISSIONS_v2.md §16 is not implemented, and there is no
  per-user notification-preference model, no in-app inbox, and no
  digest/batching — a busy day means one email per order to every
  order-owning staff account.
- **Purchase costs are not fed into the finance summary.** `GET
  /finance/summary` still derives its expense total from confirmed
  `Expense` documents only; a purchase batch's landed cost is not
  auto-logged as an expense, because a user who records both would be
  double-counted. Landed cost is per-batch cost accounting and the finance
  summary is operational spend — joining them is a deliberate decision left
  open, not an oversight.
- **A purchase's cost breakdown is immutable once received, with no
  correction path** — no edit, no reversal, no delete; the intended fix is a
  new batch (the `Investment` ledger's rule). If a batch is received with a
  wrong quantity, the stock it added is corrected through the normal
  `POST /inventory/adjust` gate, and the purchase record keeps the number it
  was received with.
- **Shop assignment is per user and additive only** — there is no per-shop
  deny list and no way to give someone every shop *except* one; unrestricted
  access is all-or-nothing via `shops.manage`. Same shape as the custom-role
  limitation above.
- **Cart/wishlist don't persist server-side or cross-device** — they're
  `localStorage`-only (see "Cart & wishlist are client-side only" above).
- **No `frontend/src/middleware.ts`** — route protection is entirely
  client-side (`RoleGuard`) plus real backend authorization; there's no
  server-side redirect before the page ships to the browser.
- **Google Sign-In is wired end-to-end but inactive** — no `GOOGLE_CLIENT_ID`
  has been provisioned on this machine, so `POST /auth/google` 503s and the
  frontend's "Continue with Google" button doesn't render. See "Google
  Sign-In" above for the exact setup steps; nothing else needs to change once
  a Client ID is added to both `.env` files.
- **No SMS gateway is actually connected to a real provider** —
  `config/sms.ts#sendSms` exists as a generic, gateway-ready abstraction
  (`isSmsConfigured`, same graceful-degrade pattern as Cloudinary/SMTP/
  Google) gated on `SMS_API_URL`/`SMS_API_KEY`/`SMS_SENDER_ID`, but no
  provider has been chosen or provisioned, so those are blank and every call
  is a logged no-op. Registration collects an optional `phone` field
  (validated + checked for duplicates) but there is still no phone-OTP
  signup flow or phone-based login; email remains the only login identifier.
  The delivery-agent OTP flow (see "Order status pipeline & delivery" above)
  works around the missing SMS by emailing the code and also surfacing it
  directly on the order owner's own tracking/account page — until a real
  provider is wired up, the delivery agent must obtain it verbally.
- **Still no arbitrary page/route creation** — `/about`, `/contact`, and
  `/shipping-policy`'s body copy is admin-editable via the fixed-type
  `StaticPage` system (see "Static page content management"), same as the
  homepage (hero/sections), header nav, and footer (columns/social links),
  but there is still no way to add a brand-new page, route, or arbitrary
  content block outside these known, fixed surfaces — nowhere in the app is
  there a general page builder.

## Documentation maintenance

Keep this file and the root `README.md` accurate as the codebase changes —
when you add/remove a route, model, page, portal feature, script, or env
var, update the relevant section here (and the corresponding summary in
`README.md`) in the same change. Only document what you've verified exists
in the code; don't carry forward stale claims or add speculative/planned
features.

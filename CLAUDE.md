# Saudi Authentic Product

An e-commerce platform (Saudi/Madinah dates, gift boxes, and future categories)
with a customer storefront plus internal Admin / Co-Admin / Super Admin /
Order Manager / Employee / Delivery Agent portals. Currency is displayed in
**BDT** and shipping uses
**Bangladesh districts** — this is intentional (the storefront targets
Bangladesh), not a bug. Two independent apps, no shared code between them:

```
backend/    Express 5 + TypeScript + Mongoose (MongoDB) REST API
frontend/   Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4
```

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
| `/auth` | register/login/`google` (Continue with Google)/refresh/logout/logout-all, `GET /me`, change-password, forgot/reset-password, verify-email/resend-verification. Login/register/google/refresh/forgot/reset/verify-email/resend-verification are rate-limited via `authLimiter`. | mostly public; `/logout-all`, `/me`, `/change-password` require auth; `/google` 503s until `GOOGLE_CLIENT_ID` is configured |
| `/users` | customer's own profile (`PATCH /me` — name/phone), avatar (`PATCH`/`DELETE /me/avatar`, image upload via Cloudinary), address CRUD (`POST`/`PATCH`/`DELETE /me/addresses[/:addressId]`); staff creation/listing/role/status/staff-meta updates | create/role/status/staff-meta: `admin`,`super_admin`; list/get: + `co_admin`; all `/me/...` routes just require `authenticate` — scoped to the calling user via `req.user.id`, no role check needed; `createStaffSchema` allows creating `employee`,`delivery_agent`,`co_admin`,`order_manager`,`admin` (never `super_admin`) |
| `/categories` | public list/get by slug; create/update (image upload)/delete | create/update: `admin`,`super_admin`,`co_admin`; delete: `admin`,`super_admin` |
| `/products` | public list/get by slug; admin get-by-id; create/update (up to 6 images + JSON-encoded `categories`/`variants`/`highlights`); delete | create/update/admin-get: `admin`,`super_admin`,`co_admin`; delete: `admin`,`super_admin` |
| `/orders` | customer creates/lists own (`/mine`); public `GET /track` (order number + email); staff lists all + updates status via the generic pipeline endpoint; delivery-agent self-scoped endpoints (`GET /assigned-to-me`, `PATCH /:id/delivery-status`, `POST /:id/verify-otp`, `PATCH /:id/delivery-failed`); order-manager/co-admin `PATCH /:id/assign-agent`; `GET /:id` ownership/staff/assigned-agent-checked in controller | list-all/status-update/assign-agent: `admin`,`super_admin`,`co_admin`,`order_manager` (+`employee` for list only); delivery-agent-only endpoints: `delivery_agent` only, self-scoped; `/track` is public (mounted before the router's `authenticate`) — see "Order status pipeline & delivery" below |
| `/reviews` | public: recent reviews, reviews by product; customer creates one review per product; staff lists all/deletes | list-all/delete: `admin`,`super_admin`,`co_admin` |
| `/attendance` | self check-in/check-out/`mine`; staff: today summary, list all, update record | admin ops: `admin`,`super_admin`,`co_admin` |
| `/leaves` | employee creates/lists own/cancels; staff lists all + approves/rejects | review/list-all: `admin`,`super_admin`,`co_admin` |
| `/tasks` | employee lists own (`/mine`) + updates own status; staff creates/lists (filterable by `type`)/updates/deletes; every task has a required `type` (packing/product_counting/stock_checking/warehouse/customer_support/data_entry/product_preparation) for task-based access categorization | create/list/update: `admin`,`super_admin`,`co_admin`; delete: `admin`,`super_admin` |
| `/performance-reviews` | employee lists own reviews; staff creates/lists | create/list: `admin`,`super_admin`,`co_admin` |
| `/salary-payments` | employee lists own payment history; admin creates payment/lists all/updates status/sends notify email | `admin`,`super_admin` **only** — co_admin is deliberately excluded |
| `/inventory` | low-stock list, logs, manual stock adjustment | `admin`,`super_admin`,`co_admin` for everything (router-level) |
| `/reports` | any staff: `/employee-dashboard`; admin/co-admin: `/dashboard`, `/sales` | dashboard/sales: `admin`,`super_admin`,`co_admin` |
| `/hero-slides` | public list; create/update (image)/delete of homepage hero carousel slides | `admin`,`super_admin` only |
| `/homepage-sections` | public list; create (promo banners & product showcases only)/update/delete of homepage content sections | `admin`,`super_admin` only |
| `/site-settings` | public `GET /` (singleton); `PATCH /` (logo upload) for site name/announcement/contact/footer | `admin`,`super_admin` only |
| `/coupons` | `POST /validate` (authenticated customer, preview a discount); `GET /`, `POST /`, `PATCH /:id` (create/update — may be gated through the approval system, see "Approval-gate system" below); `DELETE /:id` | list/create/update: `co_admin`,`admin`,`super_admin`; delete: `admin`,`super_admin` only; `/validate` just requires `authenticate` |
| `/nav-links` | public list (sorted, visible-only by default); admin create/update/delete of the storefront header's top-level nav links | create/update/delete: `admin`,`super_admin` only |
| `/footer-columns` | public list (sorted, visible-only by default); admin create/update/delete of the storefront footer's link columns (each with an embedded, wholesale-replaced `links[]`) | create/update/delete: `admin`,`super_admin` only |
| `/static-pages` | public list + `GET /:type` (lazily-seeded singleton per fixed page type); admin `PATCH /:type` (hero image upload) | update: `admin`,`super_admin` only |
| `/audit-logs` | `GET /` — read-only, general-purpose sensitive-action audit trail | `co_admin`,`order_manager`,`employee`,`delivery_agent`,`admin`,`super_admin` may call it, but every non-admin/super_admin viewer is force-scoped server-side to their own actions only — see "Approval-gate system & audit logging" below |
| `/pending-actions` | `GET /`, `PATCH /:id/grant`, `PATCH /:id/deny` — the Grant-Based Approval Workflow queue | `super_admin` only |
| `/approval-settings` | `GET /`, `PATCH /` (singleton) — the Super-Admin-editable numeric thresholds the approval gate checks against | `super_admin` only |
| `/investments` | `GET /` (list), `POST /` (create) — append-only partner investment ledger, no update/delete route | list: `admin`,`super_admin`; create: `super_admin` only |
| `/expenses` | `GET /`, `POST /`, `PATCH /:id/confirm`, `PATCH /:id/reject` | list/create: `co_admin`,`admin`,`super_admin` (co_admin scoped to own submissions); confirm/reject: `admin`,`super_admin` only |
| `/refunds` | `GET /`, `POST /`, `PATCH /:id/review`, `PATCH /:id/reject`, `PATCH /:id/approve` | create: `customer`,`order_manager`,`co_admin`,`admin`,`super_admin` (`co_admin`'s request is gated, see below); list: `order_manager`,`co_admin`,`admin`,`super_admin`; review/reject: `order_manager`,`admin`,`super_admin`; approve: `admin`,`super_admin` |
| `/finance` | `GET /summary` — combined revenue/investment/expense/profit-loss snapshot | `admin`,`super_admin` only — `co_admin` finance visibility is off by default per the spec |

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
handles `picked_up` and `out_for_delivery`; transitioning into
`out_for_delivery` generates a random 6-digit `otpCode` (`select: false` on
the schema, plus a `toJSON` transform that always strips it — defense in
depth), a 60-minute `otpExpiresAt`, and fire-and-forget emails it to the
customer via a new `sendDeliveryOtpEmail` (`email.service.ts`); repeating
the call while already `out_for_delivery` regenerates/resends the code
("Resend code" in the delivery UI) without duplicating the history entry.
Since this project has no SMS gateway, the OTP is also surfaced directly to
the order owner — `order.controller.ts`'s `getOrder`/`trackOrder` add a
top-level `otp` field to the response, but **only** when the requester is
confirmed to be the order's owner and `status === "out_for_delivery"`; staff
and the delivery agent's own endpoints never select or expose `otpCode` at
all, so the agent must obtain the code verbally from the customer (real-world
courier UX). `POST /orders/:id/verify-otp` checks the code, then records
both `otp_verified` and `delivered` in the same call, clears the OTP fields,
and — for `cod` orders — sets `isPaid = true`. `PATCH /orders/:id/delivery-failed`
requires a `failureReason` and records `delivery_failed`. `restockOrderItems()`
(shared helper) restocks and writes an `InventoryLog` entry (`reason:
"order_cancelled"` or the new `"order_returned"`) for both `cancelled` and
`returned` transitions.

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
list + a detail modal with Picked-Up/Out-for-Delivery buttons, an OTP-entry
field, and a Delivery-Failed form), `/delivery/profile` (avatar/address,
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

#### Approval-gate system & audit logging (Grant-Based Approval Workflow)

Implements ROLES_AND_PERMISSIONS_v2.md §14/§19–20 — a single reusable
`pending_actions` table (not a bespoke approval flow per feature) plus a
general-purpose audit log covering sensitive actions that aren't already
covered by `InventoryLog` (stock deltas) or `Order.statusHistory` (order
status changes).

**`PendingAction`** (`models/PendingAction.model.ts`,
`services/pendingAction.service.ts`): `actionType` (one of
`coupon.create`/`coupon.update`/`product.delete`/`refund.request`/
`refund.approve`/`expense.confirm`), `payload` (the intended change, applied
**verbatim** on grant — a Super Admin can never silently edit what was
requested, only approve or deny it), `requestedBy`/`requestedByRole`,
`status` (`pending`/`granted`/`denied`), `reviewedBy`/`reviewedAt`/
`reviewNote`. Creating one (`createPendingAction()`) fires a fire-and-forget
email (`sendPendingActionRequestedEmail`) to every active `super_admin`;
granting/denying (`grantPendingAction()`/`denyPendingAction()`, both
`super_admin`-only via `PATCH /pending-actions/:id/grant`|`/deny`) emails the
original requester the outcome. Each gated action type registers its own
"apply" function via `registerPendingActionHandler(actionType, handler)` at
the bottom of its owning service (`coupon.service.ts`, `product.service.ts`,
`refund.service.ts`, `expense.service.ts`) rather than
`pendingAction.service.ts` importing those services directly — the services
import *this* module to request a grant, so the reverse import would be
circular; since every route file (and therefore every service) is imported
by `routes/index.ts` at server startup, all handlers are registered before
any request is handled. `/admin/approvals` (super_admin only) is the review
queue (grant/deny with an optional note) plus a form for the thresholds
below.

**`ApprovalSettings`** (`models/ApprovalSettings.model.ts`,
`services/approvalSettings.service.ts`): singleton (same lazily-created
pattern as `SiteSettings`), `super_admin`-only `GET`/`PATCH
/approval-settings` — `couponAutoApprovePercent` (default 10),
`couponSuperAdminOnlyAbovePercent` (default 25), `refundAutoApproveThresholdBDT`
(default 5000), `expenseApprovalThresholdBDT` (default 2000). These numbers
are checked live by `coupon.service.ts`, `expense.service.ts`, and
`refund.service.ts` — never hardcoded, per the spec's explicit requirement.

**Product deletion** (`product.service.ts#deleteProduct`): `super_admin`
deletes directly; `co_admin` may only *request* deletion — `DELETE
/products/:id` responds `202` with a `pendingActionId` instead of deleting,
and the product is only removed once a Super Admin grants it;
**`admin` has no product-deletion access at all** (excluded from the
route's `authorize()` entirely) — a deliberate reduction from Admin's
otherwise-broad product control, per the spec. `/admin/products`'s delete
button reflects this: hidden for `admin`, a "Request deletion" action for
`co_admin`, a normal "Delete" action for `super_admin`.

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

#### Models (`src/models`)

`User` (bcrypt password, `role` enum — `customer`,`employee`,`delivery_agent`,`co_admin`,`order_manager`,`admin`,`super_admin` — `tokenVersion` for logout-all/invalidation, embedded `addresses[]`, optional `staffMeta`), `Category`, `Product` (embedded `variants[]` with per-variant price/stock/SKU, auto-derived `minPriceBDT`, text-indexed), `Order` (embedded item/shipping snapshots, `statusHistory[]` with actor/role per entry, optional `couponCode`/`discountBDT`, `assignedAgent`/OTP fields/`deliveryNotes`/`failureReason` — see "Order status pipeline & delivery" below), `Coupon` (code, discount type/value, order window, optional usage limit — see "Coupons" below), `Review` (one per customer per product), `Attendance`, `LeaveRequest`, `Task` (required `type` field categorizing task-based access — see "Order status pipeline & delivery" below for the sibling roles this supports), `PerformanceReview`, `SalaryPayment`, `InventoryLog` (audit trail for stock changes — order placed/cancelled/returned/manual adjustment), `HeroSlide`, `HomepageSection` (see "Homepage content management" below), `SiteSettings` (singleton — site name/logo/announcement/contact/footer tagline, plus an embedded `socialLinks[]` of `{platform, url}`, `platform` one of a fixed enum), `NavLink`, `FooterColumn` (see "Navigation & footer content management" below), `StaticPage` (see "Static page content management" below), `PendingAction`/`ApprovalSettings` (see "Approval-gate system & audit logging" above), `AuditLog` (general sensitive-action trail, see above), `Investment`/`Expense`/`Refund` (see "Finance module" below).

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
  `/admin/refunds` (staff-only UI for now — there is no self-service
  customer-facing "request a refund" page yet, even though the backend
  already accepts a `customer`-initiated request; that's a real gap, not a
  design choice, see Known limitations).

#### Homepage content management (not a general CMS)

`/admin/homepage` and its backing models (`HeroSlide`, `HomepageSection`) let
admins/super-admins edit the **homepage only** — this is intentionally scoped,
not a page builder:

- **Hero slides** (`HeroSlide`): freely creatable/orderable/deletable —
  image, title, subtitle, CTA label/href, sort order, active flag. All
  active slides render on the homepage as an auto-rotating carousel
  (`HeroCarousel.tsx`, dots + arrows, pause-on-hover); a single slide (or
  none — falling back to the `hero` section's text/default photo) renders
  as a static banner with no controls.
- **Homepage sections** (`HomepageSection`): a **fixed enum** of eight
  types — `hero`, `trustStrip`, `featuredCategories`, `bestSellers`,
  `productStory`, `customerReviews`, `promoBanner`, `productShowcase`. The
  first six are singleton documents (unique index on `type`), lazily seeded
  from `HOMEPAGE_SECTION_DEFAULTS`, editable (title/subtitle/description/
  image/visibility/sort order) but **not creatable or deletable**.
  `trustStrip` is the homepage's benefit/trust icon row (e.g. "100%
  Authentic", "Fast Delivery") — its own reorderable/toggleable section
  (previously hardcoded inside the hero banner) with a `blocks[]` array of
  `{icon, label, isVisible}`, `icon` drawn from the same allow-listed
  lucide-icon set `StaticPage`'s value-highlight blocks use
  (`STATIC_PAGE_BLOCK_ICONS`), edited via the same add/remove/reorder block
  editor pattern as `StaticPageForm.tsx`. `promoBanner`
  and `productShowcase` are unlimited/freely creatable and deletable.
  `promoBanner` is for ad-hoc promotional banners (image/description/CTA).
  `productShowcase` renders a configurable product grid — `productMode` is
  `"category"` (paired with `categorySlug`), `"bestSellers"`,
  `"newArrivals"` (backend `sort=newest`), or `"onSale"` (client-computed
  from `compareAtPriceBDT`, shared with `/offers` via
  `lib/productOffers.ts`), plus a `limit`. This is how admins add things
  like "Premium Dates", additional date-variety showcases, or — once real
  stock exists — a Watches/Chocolates showcase, with no code change; a
  showcase for a category with zero active products simply renders nothing
  rather than a broken/empty section.

There is no arbitrary page/route creation and no rich-text/WYSIWYG block
editor — see "Static page content management" below for `/about`,
`/contact`, and `/shipping-policy`'s own (separate, fixed-type) content
system, and "Navigation & footer content management" below for what else is
admin-editable outside the homepage. `SiteSettings` (site name, logo,
announcement bar text, contact email/phone, footer tagline, social links —
`/admin/settings`) is a separate, unrelated singleton, not part of the
homepage-section system.

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
- `authorize(...roles)` / `authorizeSelfOrRoles(getOwnerId, ...staffRoles)` — role gating (`rbac.middleware.ts`); most routes use inline `authorize(...)`, ownership checks are otherwise done ad hoc inside controllers/services.
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
order_manager | admin | super_admin` (`constants/roles.ts`). No DB permission
matrix — every route hand-lists allowed roles via `authorize(...)`, matching
existing convention. Convention: co_admin can run day-to-day HR (attendance/
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
unknown email or an already-verified account. `requireEmailVerified`
(applied after `authenticate`) blocks the two customer-only write actions —
`POST /orders` and `POST /reviews/product/:productId` — for a `customer`
whose `isEmailVerified` is still `false`; staff roles are always exempt.
Staff accounts (`user.service.ts#createStaffAccount`), Google Sign-In
accounts (Google already verified the email), and every seeded account
(`seed/seed.ts`) are created with `isEmailVerified: true` — the gate only
ever applies to the self-service storefront registration flow.
`GET /auth/me`'s `user.isEmailVerified` drives the frontend: `/account`
shows a persistent `EmailVerificationBanner` (with a resend button) above
the dashboard for an unverified customer, and `/checkout`
(`CheckoutClient.tsx`) shows the same banner instead of the order form —
both disappear automatically once `AuthContext` re-fetches `/auth/me` with
`isEmailVerified: true`. `frontend/src/app/(site)/account/verify-email/page.tsx`
handles the link itself, distinguishing verified / already-verified /
expired / invalid / missing-token states, with a resend form (plain email
input, works whether or not the visitor is logged in) on the two error
states.

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

**Uploads**: `multer` (memory storage) → `uploadBufferToCloudinary()` in
`config/cloudinary.ts`. Guarded by `isCloudinaryConfigured`; returns a clear
503 if Cloudinary env vars are unset rather than a confusing SDK error.
`deleteCloudinaryImage()` is best-effort and swallows errors.

**Email**: `services/email.service.ts` exports `sendPasswordResetEmail`,
`sendDeliveryOtpEmail`,
`sendStaffWelcomeEmail`, `sendOrderConfirmationEmail`, `sendLeaveStatusEmail`,
`sendTaskAssignedEmail`, `sendSalaryPaymentEmail` — all HTML via a shared
`layout()`/`button()` helper, routed through `safeSend()` (catches/logs,
never throws) → `config/mailer.ts` (nodemailer transporter, lazily created)
→ guarded by `isSmtpConfigured`. **All email sends are fire-and-forget
(`void sendXEmail(...)`, never `await`)** — confirmed at every call site
(`leave.service.ts`, `order.service.ts`, `user.service.ts`, `auth.service.ts`,
`task.service.ts`, `salary.service.ts`) — a real SMTP round-trip is too slow
to block the request, and `safeSend()` already swallows and logs failures so
callers never need to handle rejections.

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
HTTP-through-Mongoose integration specs (`auth`, `catalog`, `order`,
`orderStatus`, `task`, `coupon`, `approvalGate`, `finance`) run against an
actual in-memory MongoDB via `mongodb-memory-server`
(`tests/integration/setup.ts` starts/stops it and wipes collections between
tests; `tests/integration/helpers.ts` creates a DB-backed user and signs a
bearer token for it, bypassing `authLimiter` so RBAC-focused tests aren't
rate-limited). They exercise `createApp()` with `supertest` end-to-end:
register/login/`me`/logout, category+product RBAC and creation, order
creation/stock-decrement/tracking/ownership, `orderStatus.integration.test.ts`
(full pending→delivered pipeline walk with actor/role history assertions,
invalid-transition/terminal-status rejection, admin's
actor-gate-bypass-but-not-adjacency-table override, `order_manager`/
`delivery_agent` RBAC against unrelated resources, delivery-agent
self-scoping between two different agents, and the OTP flow's owner-only/
staff-hidden visibility), `task.integration.test.ts` (required `type` field,
`type` query filtering), `coupon.integration.test.ts` (discount-size gating
— auto-approve/pending/forbidden thresholds for `co_admin`, plus a
super_admin grant materializing the original payload),
`approvalGate.integration.test.ts` (product-deletion gating across
`super_admin`/`co_admin`/`admin`, grant/deny, audit-log recording and
per-role visibility scoping, threshold-settings edit), and
`finance.integration.test.ts` (investment RBAC, co_admin expense submission
+ threshold-gated confirmation, and a full refund walk from request through
Order-Manager review to Admin approval — including the above-threshold
grant path — asserting the order transitions to `"refunded"` and a linked
`Expense` is auto-logged). All suites run together via `npm test` (Jest +
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
`/shop` (filterable catalog), `/product/[slug]` (detail, `force-dynamic`),
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
backend exists for them. Staff roles see a redirect card to `/admin`,
`/employee`, or `/delivery` (whichever portal matches their role) instead of
the dashboard; when signed out, renders `AuthForms` —
the single Sign In / Register / Forgot Password form shared by **every**
role, see "Registration" and "Forgot / reset password" above), `/account/reset-password` (Set a New
Password — Confirm Password field + live strength meter, see above),
`/track-order` (public order-tracking form — order number + checkout email,
no login required; auto-prefills from a logged-in customer's own email and
from an `?orderNumber=` query param when arrived at via the "Track Order"
link on an order card; see "Public order tracking" above), `/about`,
`/contact`, `/shipping-policy`. There is no standalone `/reviews` page —
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
`app/admin/layout.tsx`. Every page below does real CRUD against the live
API (loading/empty/error states via `EmptyState`/`TableSkeleton`/`ErrorState`,
modal forms via `Modal.tsx`, `PageHeader`, `StatusBadge`,
`AdminPagination`) — none are placeholders:

`/admin` (dashboard: revenue/orders/customers/active-products/low-stock/
pending-leaves stat cards, today's attendance, top products), `/admin/products`
(delete button is role-aware — hidden for `admin`, "Request deletion" for
`co_admin`, "Delete" for `super_admin`, see "Approval-gate system" above),
`/admin/categories`, `/admin/orders` (includes an "Assign Delivery Agent"
picker on orders that are `ready_for_dispatch`/`delivery_failed` — see
"Order status pipeline & delivery" above), `/admin/refunds` (Order Manager
review + Admin/Super Admin approval — see "Finance module" above),
`/admin/coupons` (reachable by `co_admin` now too — large-discount
create/update requests may come back as a pending-approval notice instead
of an immediate save), `/admin/customers`, `/admin/reviews`,
`/admin/employees`, `/admin/attendance`, `/admin/leave`, `/admin/tasks`,
`/admin/performance`, `/admin/salary` (nav-hidden from co_admin),
`/admin/inventory`, `/admin/reports`, `/admin/finance` (revenue/expense/
investment/profit-loss summary, nav-hidden from co_admin),
`/admin/investments` (nav-hidden from co_admin), `/admin/expenses`
(reachable by co_admin — scoped to their own submissions), `/admin/approvals`
(Grant-Based Approval Workflow queue + threshold settings, `super_admin`
only), `/admin/audit-logs` (reachable by every admin-portal role plus
`order_manager` — scoped server-side to own actions for everyone except
admin/super_admin), `/admin/homepage` (hero slides + homepage sections —
nav-hidden from co_admin), `/admin/navigation` (header nav links —
nav-hidden from co_admin), `/admin/footer` (footer link columns — nav-hidden
from co_admin), `/admin/pages` (About/Contact/Shipping Policy body copy —
nav-hidden from co_admin), `/admin/settings` (site settings, including
social links — nav-hidden from co_admin). `order_manager`'s nav
(`AdminNav.tsx`) is explicitly restricted to `Dashboard`, `Orders`,
`Refunds`, and `Audit Logs` — every other item declares an explicit `roles`
list that excludes it — so an Order Manager reaches the same `/admin` shell
as everyone else but sees a much smaller nav; the real boundary is still
backend `authorize()`.

**Co-admin admin-portal UX**: the layout's `RoleGuard` (`app/admin/layout.tsx`)
accepts the whole `["co_admin","order_manager","admin","super_admin"]` union
— it's a role gate, not a per-page one — so a co_admin who navigates
directly to `/admin/salary`, `/admin/finance`, `/admin/investments`,
`/admin/homepage`, `/admin/navigation`, `/admin/footer`, `/admin/pages`, or
`/admin/settings` still reaches the page shell (`AdminNav.tsx` only hides
the link, it doesn't block the route). Each of those pages handles this
itself with a page-level check — `const isRestricted = user?.role ===
"co_admin"` — that renders a friendly `EmptyState` ("Access restricted...
available to Admin and Super Admin only") instead of attempting to load
data, rather than letting the page render its normal shell and have every
API call inside it 403. This is UX polish on top of the backend's real
authorization boundary (those routes already reject co_admin server-side)
— not a substitute for it, and not a security fix, since the API was never
reachable by co_admin in the first place. **`/admin/coupons` is no longer on
this restricted list** — co_admin has real, working (if discount-size-gated)
access to it now, unlike the other pages here which remain fully blocked.
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
alongside the existing priority badge/status dropdown), `/employee/leave`,
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
their own. Only when the refresh itself fails (the 30-day refresh-token
cookie is also expired/invalid) does `AuthContext` drop out of its
signed-in state — via `setAuthFailureHandler()`, a small callback registry
`client.ts` exposes so `AuthContext` can react immediately instead of
waiting for its next `GET /auth/me` poll. A session that sits open past the
access-token TTL now survives transparently instead of 401ing the next
mutating request (e.g. placing an order) and silently signing the user out
— confirmed live: registered a customer with a temporarily-shortened
`JWT_ACCESS_EXPIRES_IN=5s`, waited past expiry, and the next request
(`GET /auth/me`) 401'd, silently refreshed, and retried successfully with no
redirect to sign-in.

**Cart & wishlist are client-side only**: `CartContext` and `WishlistContext`
persist to `localStorage` (`sap:cart`, `sap:wishlist` keys) and resolve full
product data via `useProductsByIds`. They are **not** synced to the backend
or tied to the logged-in account — a cart/wishlist doesn't follow a customer
across devices or browsers, and is lost if `localStorage` is cleared. There
is no server-side cart/wishlist model. Keep this in mind before promising
cross-device persistence.

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

**Design tokens** (`app/globals.css`, Tailwind v4 `@theme inline`, no
`tailwind.config.js`): cream (`cream-50..400`), green (`green-950/900/800`),
gold (`gold-500/600/700`), brown (`brown-500/600/700`), ink (`ink-900`).
Fonts: EB Garamond (`font-serif`, headings) + Plus Jakarta Sans (`font-sans`,
body) — self-hosted via `@fontsource/*` packages imported in `app/layout.tsx`
(not `next/font`). Reuse `cn()` and `formatBDT()` from `lib/utils.ts` and the
primitives in `components/ui/` — don't hand-roll new buttons/cards/headings.

**No form or state-management library**: forms and data fetching are
hand-rolled with `useState`/`useEffect` + the custom `lib/api` client — no
react-hook-form, no SWR/React Query, no Redux/Zustand. Match this pattern for
new forms/pages rather than introducing a new library.

**Testing**: Vitest + React Testing Library (`vitest.config.mts`,
`vitest.setup.ts` — jsdom environment, `@/*` alias resolved to `src/`,
`@testing-library/jest-dom` matchers). `npm test` runs `vitest run`,
`npm run test:watch` for the interactive watcher. Coverage is intentionally
basic, not exhaustive: pure-logic unit tests (`lib/utils.test.ts`,
`lib/passwordStrength.test.ts`, `lib/mappers.test.ts`), a component test
(`components/ui/PasswordStrengthMeter.test.tsx`), and a context/hook test
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

## Coding rules

- Match the existing layered pattern exactly (see Architecture above) —
  don't introduce a different style for new resources.
- Don't add a DB-backed permission system; role-gate routes with
  `authorize(...)` like every existing route does.
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
  `authorize()` role gating for a specific, spec-defined list of high-risk
  actions — they are not a replacement DB-backed permission system, and the
  "don't add a DB-backed permission system" rule above still applies to
  everything else. To gate a new action type: add it to
  `PENDING_ACTION_TYPES` (`models/PendingAction.model.ts`), register an
  apply-handler via `registerPendingActionHandler()` at the bottom of the
  owning service (never have `pendingAction.service.ts` import that service
  directly — see "Approval-gate system & audit logging"), and call
  `createPendingAction()` at the point where the gate should trigger. Any
  new Super-Admin-editable numeric threshold belongs on `ApprovalSettings`,
  never hardcoded.
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
- **No customer-facing "request a refund" UI** — `POST /refunds` already
  accepts a `customer`-initiated request on their own order (see "Finance
  module" above), but there is no page/button anywhere in the storefront or
  account portal that calls it; today a refund request can only be created
  from `/admin/refunds` by staff. This is a real, unfilled gap, not a
  deliberate scope boundary.
- **The approval-gate system covers a fixed, spec-defined list of actions**
  (`coupon.create`/`.update`, `product.delete`, `refund.request`/`.approve`,
  `expense.confirm`) — role changes, settings changes, and other sensitive
  actions are audit-*logged* (see "Approval-gate system & audit logging"
  above) but are **not** routed through the Grant-Based Approval Workflow;
  only the six action types above create a `PendingAction`.
- **No 2FA, session-timeout enforcement, account-lockout, or
  impersonation/support-login feature** — ROLES_AND_PERMISSIONS_v2.md §13/§15
  describe these, but they were out of scope for the approval-gate/finance
  build and have not been implemented; existing auth security (bcrypt,
  JWT cookies, `authLimiter` rate limiting, logout-all via `tokenVersion`)
  is unchanged, see "Security" below.
- **No general notification matrix** — only approval-gate-related
  notifications exist (a Super Admin is emailed when a request needs their
  review; the requester is emailed the grant/deny outcome). The wider event
  list in ROLES_AND_PERMISSIONS_v2.md §16 (new-order alerts, low-stock
  alerts, delivery-failure escalation, etc.) is not implemented.
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
- **No SMS gateway anywhere in this project** — registration collects an
  optional `phone` field (validated + checked for duplicates) but there is no
  phone-OTP signup flow or phone-based login; email remains the only login
  identifier. The delivery-agent OTP flow (see "Order status pipeline &
  delivery" above) works around this by emailing the code and also
  surfacing it directly on the order owner's own tracking/account page —
  it is not texted to the customer, and the delivery agent must obtain it
  verbally.
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

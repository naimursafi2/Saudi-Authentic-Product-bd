# Saudi Authentic Product — AI Development Guide

E-commerce platform (Saudi/Madinah dates, gift boxes) targeting Bangladesh —
currency **BDT**, shipping uses **Bangladesh districts** (intentional, not a
bug). Customer storefront + internal Admin/Co-Admin/Super Admin/Order
Manager/Employee/Delivery Agent portals. Two independent apps, **no shared
code**:

```
server/    Express 5 + TypeScript + Mongoose (MongoDB) REST API
client/    Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4
```

Some code comments still say `backend/`/`frontend/` from an earlier layout —
read those as `server/`/`client/`. Deployment: Vercel (client) / Render
(server), different origins — see `client/src/proxy.ts` for cookie
implications.

## Documentation policy (read this before editing README.md or CLAUDE.md)

- **README.md** = public docs: overview, features, tech stack, setup, env
  vars, scripts, API summary, project structure, deployment.
- **CLAUDE.md** (this file) = AI dev rules: architecture, patterns, coding
  conventions, RBAC, DB patterns, commands, things not to change.
- **On every future change: edit only the specific section affected.** Don't
  read either file in full unless you genuinely need to. Don't rewrite a
  whole file for a small update. Don't add information that already exists
  elsewhere in either file. Don't touch README.md for a backend-only change
  or CLAUDE.md for a copy-only change — only update a file if the change
  genuinely affects what that file documents. If a change needs no doc
  update, make none.
- Only document verified, implemented behavior — never speculative/planned
  features. If you find a stale claim, fix or remove it, but don't go
  looking for staleness outside the section you're already touching.
- Do not create a `docs/` folder or additional documentation files. These
  two files are the only project documentation.

## Architecture

### Backend (`server/src`)

Layered, one pattern per resource — match it exactly for any new resource:

```
routes/<resource>.routes.ts        Express Router — auth/authorize/validate/upload wiring
controllers/<resource>.controller.ts  Thin, catchAsync-wrapped, calls service, calls sendSuccess
services/<resource>.service.ts     All business logic + Mongoose queries, throws ApiError
validators/<resource>.validator.ts   zod schemas (create/update/list-query), z.infer'd types
models/<Resource>.model.ts         Mongoose schema + interface
```

Register every new router in `routes/index.ts`. Core utilities — reuse, don't
reinvent: `catchAsync(handler)`, `sendSuccess(res, code, message, data?,
meta?)`, `ApiError.badRequest/unauthorized/forbidden/notFound/conflict/
internal(msg, errors?)`, `paramStr(req.params.x)`.

Middlewares (`src/middlewares`): `authenticate` (JWT from `accessToken`
cookie or `Authorization: Bearer`), `requireEmailVerified` (blocks an
unverified `customer` on `POST /orders` and `POST /reviews/...`, staff
exempt), `requirePermission(...)`/`requireAllPermissions(...)` (the primary
authorization gate — see Roles & Permissions below), `authorize(...roles)`
(role-identity checks only, still used for self-scoped ownership),
`validate({body,query,params})` (zod-parses, **replaces** the field via
`Object.defineProperty` — see the Express 5 gotcha below), `sanitizeRequest`
(NoSQL-injection stripping, same `Object.defineProperty` fix), `upload`
(multer memory storage, image-only, 2MB/6-file limits), rate limiters
(`authLimiter` 15min/20req, `apiLimiter` 15min/600req).

### Routes (mounted under `API_PREFIX`, default `/api/v1`)

| Base path | Covers | Default access beyond `authenticate` |
| --- | --- | --- |
| `/auth` | register/login/google/refresh/logout(-all)/`me`/change-password/forgot-reset-password/verify-email | mostly public; `/me` needs auth |
| `/users` | own profile/avatar/addresses; own NID edit-request; staff CRUD, unlock, impersonate, customer-stats | staff-create/role/status: `admin`+; impersonate: `super_admin` only; NID writes gated (see Approval-gate) |
| `/categories`, `/products` | public list/get; staff create/update/delete | `admin`,`super_admin`,`co_admin` (product delete: `co_admin`+`super_admin` only, `admin` excluded) |
| `/orders` | customer create/list-own; public `/track`; staff list/update-status; delivery-agent self-scoped endpoints | see "Order pipeline" below |
| `/reviews` | public read; verified-purchase customer create; staff moderate | delete/visibility: `admin`,`super_admin`,`co_admin` |
| `/leaves`, `/tasks`, `/performance-reviews` | employee self-service + staff review/CRUD | staff ops: `admin`,`super_admin`,`co_admin` |
| `/salary-payments` | employee own history; admin CRUD | `admin`,`super_admin` only (co_admin excluded) |
| `/inventory` | live stock, low/out-of-stock lists, logs, manual adjust | adjust applies immediately only for `super_admin` (else gated) |
| `/reports`, `/finance` | dashboards, sales/gross-profit/revenue time series, inventory valuation | `admin`,`super_admin`,`co_admin` (finance: `co_admin` excluded by default) |
| `/purchases` | purchase-batch CRUD, cost items, receive, traceability | `purchases.view/create/edit/delete` |
| `/coupons` | validate (customer preview); staff CRUD, gated by discount size | `co_admin`,`admin`,`super_admin`; delete `admin`+ only |
| `/hero-slides`, `/homepage-sections`, `/nav-links`, `/footer-columns`, `/static-pages`, `/site-settings` | admin-editable storefront content | mostly `admin`,`super_admin`(+`co_admin` for hero/homepage/logo) |
| `/audit-logs` | read-only sensitive-action trail | every staff role, force-scoped to own actions except `admin`/`super_admin` |
| `/pending-actions`, `/approval-settings` | Grant-Based Approval Workflow queue + thresholds | `super_admin` only |
| `/investments`, `/expenses`, `/refunds`, `/returns` | Finance module | see "Finance module" below |
| `/roles` | permission catalogue, role CRUD, user role assignment | `roles.view`/`roles.manage`/`employees.manage` |
| `/campaigns` | customer messaging campaigns | `campaigns.*` permissions, see below |
| `/notifications`, `/product-alerts` | customer's own inbox / price-drop subscriptions | self-scoped, `authenticate` only |
| `/payments` | public provider-availability flags; customer bKash create/execute/cancel; staff read-only list | customer routes self-scoped; staff list `payments.view` |
| `/shipping-settings` | public read of the live shipping rates; admin edit | read public; `PATCH` needs `settings.manage` |
| `/internal-assets` | staff upload registry, delete requests, Recycle Bin, restore, permanent deletion | staff request-own: `assets.request_delete`; everything else `assets.manage` (Super Admin) |

## Roles & permissions (RBAC)

**Role + permission based**, not hardcoded role lists. Routes call
`requirePermission("some.permission")`; a role's permission list is a `Role`
document in the DB.

- `constants/permissions.ts` — `PERMISSIONS` (flat catalogue),
  `PERMISSION_GROUPS` (admin-panel checkbox grouping),
  `ROLE_DEFAULT_PERMISSIONS` (the 7 built-in roles' seeded sets).
  `super_admin` is absent — special-cased to hold every permission, its role
  document can't be edited.
- `models/Role.model.ts` — `{key, name, permissions[], isSystem, isActive}`.
  System roles (`isSystem: true`) match `User.role` exactly. Custom roles are
  freely creatable from `/admin/roles`.
- `User.customRole` — optional ref to a custom role; **adds** permissions on
  top of the built-in `role`, never removes them.
- `role.service.ts#resolvePermissions` — base ∪ custom, cached in-process
  (invalidated on write — an edit applies on the caller's next request, no
  re-login; **cache is per-process**, so a multi-instance deploy needs a
  restart on each instance).
- `requirePermission(...)` passes if the caller holds ANY listed permission;
  `requireAllPermissions(...)` needs all.

**Escalation guards (in the service, not the route):** you may only grant a
permission you hold yourself; only `super_admin` may re-permission a
**built-in** role; `SUPER_ADMIN` can't be edited by anyone; a built-in role
can't be deleted, nor a custom role still assigned to someone. Every
create/update/delete/assignment is audit-logged.

**Adding a new permission:** add the key to `constants/permissions.ts` (+ a
`PERMISSION_GROUPS` entry), mirror it in `client/src/lib/permissions.ts`,
reference it from the route. **Permissions are code** (a permission no route
consults grants nothing); **roles are data** (never need a code change).

Frontend: `lib/permissions.ts` mirrors the catalogue (kept in sync
manually — no shared code between apps); `AuthContext` exposes
`hasPermission(...)`; `AdminNav`/`RoleGuard` filter by permission, not role,
so a custom role gets a correct menu/access automatically. **None of this is
a security boundary** — it hides menu items only; the API re-checks every
permission on every request.

## Approval-gate system (Grant-Based Approval Workflow)

A single reusable `pending_actions` table gates a **fixed list** of
high-risk action types — not a bespoke flow per feature.

- `models/PendingAction.model.ts` — `PENDING_ACTION_TYPES` enum (currently:
  `coupon.create/.update`, `product.create/.delete/.stock.update`,
  `inventory.adjust`, `refund.request/.approve`, `expense.confirm/.edit`,
  `purchase.receive`, `user.nid.update`). `payload` is applied **verbatim**
  on grant.
- `services/pendingAction.service.ts` — `createPendingAction()`,
  `grantPendingAction()`/`denyPendingAction()` (`super_admin` only, via
  `PATCH /pending-actions/:id/grant`|`/deny`). Emails the requester on
  review, every super_admin on submission.
- Each gated action type **registers its own apply-handler** via
  `registerPendingActionHandler(actionType, handler)` at the bottom of its
  *owning* service (never have `pendingAction.service.ts` import that
  service directly — it would be circular, since the owning service imports
  *this* module to request a grant). An optional
  `registerPendingActionDenyHandler(...)` undoes any pre-review side effect
  (e.g. `product.create`'s uploaded images) on denial.
- `models/ApprovalSettings.model.ts` — singleton, `super_admin`-only,
  the numeric thresholds (`couponAutoApprovePercent`,
  `refundAutoApproveThresholdBDT`, `expenseApprovalThresholdBDT`, etc.) that
  decide auto-apply vs. gate. **Any new Super-Admin-editable threshold
  belongs here, never hardcoded.**

**To gate a new action type:** add it to `PENDING_ACTION_TYPES`, register a
handler via `registerPendingActionHandler()`, call `createPendingAction()`
at the trigger point. The approval gate answers "may this change take effect
*yet*", a different question from "may this person make it *at all*"
(permission check) — neither replaces the other.

**Stock has exactly one source of truth**, `Product.variants[].stock` — no
denormalized copy anywhere. **Only `super_admin` changes stock directly**
(via `POST /inventory/adjust` or the stock fields on `PATCH /products/:id`);
every other role's change is queued, live count untouched until granted.
Automatic stock movement (order placed/cancelled/returned) is **never**
gated. Same "only super_admin bypasses the gate" shape applies to product
creation (`admin`/`co_admin` submissions are queued, not published),
product deletion (`co_admin` requests, `admin` has no access at all,
`super_admin` deletes directly), receiving a purchase batch that's
linked to a catalogue variant, and staff **identity documents** (below).

**Sensitive documents are never edited or deleted directly by the staff who
hold them.** Two separate mechanisms already cover this — reuse them, don't
build a third:

- **Deleting a file** goes through the internal-asset lifecycle
  (`retireInternalAsset()` → `delete_requested` → Super Admin approves/
  rejects → Recycle Bin → restore or purge), which applies to *every*
  internal upload — NID scans, cash memos, purchase proofs, delivery proof
  photos — with a full append-only `history[]` of who did what and when.
- **Changing a document's contents** goes through the approval gate.
  `user.nid.update` covers a staff member's NID number and card scan: only
  `super_admin` writes one directly, everyone else's change is queued (the
  live record keeps its old value until granted), and a rejected replacement
  scan is retired by the registered deny-handler rather than left orphaned.
  `applyNidChange()` in `user.service.ts` is the single write path both
  routes converge on, so the audit entry and the old scan's retirement can't
  be skipped by either one. Ordinary employment fields (department,
  designation, salary) are *not* gated — only the identity document is.
- A staff member can ask for a correction to **their own** document via
  `POST /users/me/staff-meta/nid-edit-request`, which is self-scoped by
  construction (the subject is always `req.user`) and so needs no permission.
  It has no branch that writes the record, deliberately: the subject of a
  document is never the person who approves changes to it.

**Variant identity across edits**: the product form round-trips each
variant's `_id`; `updateProduct` reuses it so cart lines/order items never
get silently orphaned by an unrelated edit. Identity match is strict (a
foreign/stale id becomes a new variant); stock carry-over falls back to
array position if no id round-trips.

## Audit logging

`models/AuditLog.model.ts` — append-only, `{actor, actorRole, action,
resource, resourceId?, oldValue?, newValue?, note?, createdAt}`. `action`/
`resource` are free-form dot-namespaced strings, not a closed enum.
`recordAuditLog()` (`services/auditLog.service.ts`) **never throws** — safe
to call inline for any new sensitive action (role/status changes, financial
approvals, settings changes, create/update/delete on anything an owner
shouldn't be able to silently undo) not already covered by `InventoryLog` or
`Order.statusHistory`.

`GET /audit-logs` is read-only; `super_admin`/`admin` see everything, every
other viewer is **force-scoped server-side** to their own actions regardless
of any filter passed. Supports an optional `resourceId` filter for one
record's own trail (e.g. one Expense's edit history).

Frontend (`client/src/lib/auditLogDisplay.tsx`): **never render
`log.action`/`log.resource` directly** — always through this shared
module's `ActionBadge`/`resourceLabel`/`friendlyNote`/`actorName` helpers
(used by both `/admin/audit-logs` and the dashboard's "Recent Activities"
widget), which translate raw action strings via two hand-written
dictionaries (direct actions, and gated actions × `.request`/`.grant`/
`.deny`).

## Database models (`src/models`)

`User` (bcrypt password, 7-role enum, `tokenVersion` for logout-all,
embedded `addresses[]`, optional `staffMeta`, lockout fields — see
Security below), `Category`, `Product` (embedded `variants[]`,
auto-derived `minPriceBDT`), `Order` (embedded items/shipping snapshot,
`statusHistory[]`, OTP fields — see Order pipeline), `Coupon`, `Review`,
`LeaveRequest`, `Task`, `PerformanceReview`, `SalaryPayment`,
`InventoryLog` (stock-change audit trail), `HeroSlide`/`HomepageSection`/
`NavLink`/`FooterColumn`/`StaticPage`/`SiteSettings` (storefront content),
`Role`/`PendingAction`/`ApprovalSettings`/`AuditLog` (governance),
`Investment`/`Expense`/`Refund` (finance), `Payment` (bKash gateway
transactions), `ShippingSettings` (singleton delivery rates),
`InternalAsset` (staff upload registry + recycle bin),
`Purchase` (landed-cost batches),
`Campaign`/`Notification` (messaging), `ProductAlert` (price-drop/
back-in-stock subscriptions), `ReturnRequest`.

## Key domain patterns

**Derive on read, never store a computed value** — `Coupon.status`,
`Purchase`'s `totalLandedCostBDT`/`unitCostBDT`, `Order.grossProfitBDT`,
`Order.estimatedDeliveryDate` are all Mongoose virtuals, not stored fields.
Follow this for any new "total"/"status that depends on other fields" —
a stored copy goes stale the moment its inputs change. Exception: a figure
that must stay historically accurate after its inputs later change (e.g. an
order item's landed cost at time of sale) is frozen at write time instead —
see FIFO batch consumption below.

**Order pipeline & delivery** (`constants/orderStatus.ts`,
`order.service.ts`): 14-status pipeline (`pending → confirmed → processing
→ packed → ready_for_dispatch → assigned_to_agent → picked_up →
out_for_delivery → otp_verified → delivered`, plus `delivery_failed`/
`cancelled`/`returned`/`refunded`). `ORDER_TRANSITIONS` is an explicit
adjacency map enforced regardless of role; `DELIVERY_ONLY_STATUSES` can only
be reached via their own dedicated endpoints, never the generic `PATCH
/orders/:id/status`. Delivery confirmation requires a 4-digit OTP (5-minute
TTL, 5 max attempts) sent to the customer by email (no SMS gateway
connected — see Known limitations) and also surfaced on their own
tracking/account page.

**Sale-time FIFO batch consumption & profit**
(`inventory.service.ts#consumeStockForSale`/`restockFromSale`): every order
line draws from the variant's received `Purchase` batches oldest-received
first, decrementing each batch's `remainingQuantity` via a guarded atomic
update (`{remainingQuantity: {$gte: take}}` + `$inc` — same pattern as
`coupon.service.ts#applyCouponUsage`'s usage-limit guard; **this codebase
uses no MongoDB transactions anywhere** since the test DB
(`mongodb-memory-server`) is a standalone instance, not a replica set —
keep using single-document atomic guards for anything that needs
concurrency safety). Falls back to the weighted-average landed cost across
all received batches when a batch runs out, and to `0`/`costBasisKnown:
false` only when no batch has ever existed for that variant. The resolved
`unitLandedCostBDT`/`costBasisKnown`/`batchConsumptions[]` are **frozen**
onto `Order.items[]` at sale time (not derived-on-read, since a batch's own
cost keeps changing after the sale) — `Order.model.ts` then derives
`costOfGoodsSoldBDT`/`grossProfitBDT` as virtuals on top of those frozen
values. Cancelling/returning an order credits the exact same batches back.
This whole path is keyed only off `{product, variantId}` — no
product-type/category branching, ever.

**Profit & loss** (`finance.service.ts`): the frozen landed costs above are
what the finance module nets against revenue, so the P&L reads as a real
income statement — net selling revenue (subtotal − discount; shipping excluded
as pass-through) − cost of goods sold = gross profit, − confirmed operating
expenses = net profit/loss. `getCostOfGoodsSold()` collapses the same
aggregation `getGrossProfitTimeSeries()` buckets by period, and `orderMatch()`/
`expenseMatch()` are shared by every query in the file, so the single-figure
summary and the period rows can never disagree. `getFinanceSummary()` and
`getRevenueVsExpenseTimeSeries()` both subtract COGS: a "profit" figure
anywhere in this codebase that is only revenue minus expenses is a bug.
`cashBalanceBDT` is deliberately *not* a profit figure — it is cash on hand
(investment + revenue − expenses) and excludes stock purchases, which convert
cash into inventory rather than spending it.

**Internal upload lifecycle** (`models/InternalAsset.model.ts`,
`services/internalAsset.service.ts`): every file uploaded by internal staff is
indexed in one central registry, and no staff member can destroy one.

Files stay where they already live — embedded `{url, publicId}` on Product,
Category, Expense, Purchase and the rest. `InternalAsset` *indexes* them
through a generic `resource`/`resourceId`/`fieldPath` triple, so **no feature
is named anywhere in the model or service** and a new internal upload type is
supported by recording it, never by writing another delete flow.

Two calls are the whole integration surface, and both must be used instead of
the raw Cloudinary helpers in any staff path:
- `uploadInternalFile(file, {folder, resource, fieldPath, module, actor})` —
  uploads and registers in one step, returning the same shape
  `uploadBufferToCloudinary` did.
- `retireInternalAsset(publicId, actor, reason)` — replaces
  `deleteCloudinaryImage`. A tracked internal file enters `delete_requested`
  and **the Cloudinary object is left intact**; an untracked file (customer
  review photo, customer avatar, anything predating this system) still deletes
  immediately, so existing behaviour is preserved.

Lifecycle: `active` → `delete_requested` → (Super Admin rejects → `active`) |
(approves → `recycled`, `purgeAfter` = now + 15 days) → `restored` back to
`active` reusing the original file, or `purged` by the scheduler sweep or an
explicitly confirmed immediate deletion. A `purged` row is kept as the
permanent audit record and can never be restored. `purgeExpiredAssets()`
counts and logs per-file failures without stopping, leaving a stuck file in
the bin with a raised `purgeAttempts` for the next tick rather than losing it.

**Customer uploads are outside this system entirely** — `isInternalRole()`
excludes `customer`, so review photos and a customer's own avatar are never
registered and keep their immediate-delete behaviour.

**Shipping is configuration, not code** (`models/ShippingSettings.model.ts`,
`constants/shipping.ts`): a singleton document holds the inside-Dhaka and
outside-Dhaka charges, the express surcharge, the free-shipping switch /
threshold / express-applicability, and the per-method delivery-day estimates.
Its defaults reproduce the rates that used to be literals (৳60 / ৳120 / free
over ৳5,000), so adopting it repriced nothing.

`computeShippingFee(input, rates)` is **pure — it takes the rates as an
argument and never reads them itself**, so it is testable against any rate
combination and has exactly one authoritative call site:
`order.service.ts#createOrder`, which awaits `getShippingSettings()` and
computes the fee from the submitted district and the live rates. The client
sends no shipping figure (there is no such field on `createOrderSchema`);
`client/src/lib/shipping.ts` mirrors only the *formula* for display, never the
numbers. **Any new shipping rule belongs on this model — never as a literal in
either app.**

`Order.estimatedDeliveryDate` stays a virtual, reading the day counts from a
synchronous in-process snapshot (`getCachedShippingRates()`) because Mongoose
virtuals cannot await. That snapshot is never used for money — every charged
fee comes from a freshly awaited settings read — so a cold or stale cache can
only make an estimate briefly out of date. Per-process, like the role cache.

**Payments (bKash)** (`models/Payment.model.ts`, `services/payment.service.ts`,
`config/bkash.ts`): the gateway client is isolated in `config/bkash.ts` — no
credential, grant token or raw gateway body ever leaves it, and it 503s
gracefully when `BKASH_*` is unset (same shape as Cloudinary/SMTP/SMS). A
`Payment` record exists **only for gateway transactions**; a `cod` order is
fully described by `Order.paymentMethod`/`Order.isPaid` and gets no record.

**The client never sends an amount, anywhere in the payment path** — every
payment request body carries an order id (or the gateway's `paymentID`) and
nothing else, so the payable figure is always `order.totalBDT`, itself
recomputed at checkout from live variant prices, a re-validated coupon and
`computeShippingFee()`. Verification re-checks the gateway's settled amount
against both `payment.amountBDT` and `order.totalBDT`, **compared in paisa**,
plus the merchant invoice reference and `transactionStatus === "Completed"`;
any mismatch marks the payment `failed` and returns one deliberately uniform
message, never naming which check failed. Nothing is marked paid on the
frontend's say-so.

`PAYMENT_TRANSITIONS` gates every status write, and settling is a single
guarded atomic update (`{status: {$in: ["initiated","pending"]}}` → `paid`)
— the winner confirms the order, every replay reports the already-settled
payment as a success. **Payment confirmation has no inventory side effect
at all**: stock is consumed once by `createOrder`, so a replayed callback
cannot double-deduct. Adding a future gateway is a `PAYMENT_PROVIDERS`
value, a client beside `config/bkash.ts` and a branch in the service —
never a change to the order or inventory pipeline.

**Verification is entirely automatic — there is deliberately no manual
staff step, and no permission that would allow one.** Two paths settle a
payment, both server-side against bKash: the customer's own callback
(`/payments/bkash/execute`), and `reconcileStalePayments()` on the
scheduler for anyone whose browser never made it back (closed tab, dead
connection). The sweep leaves a payment alone for 15 minutes so it never
races the customer's callback, and only fails a still-"Initiated" one after
45 minutes, past the bKash session window, so a slow customer is never
failed out from under themselves. It swallows per-payment errors so one
unreachable gateway call cannot stall the sweep. Staff endpoints are
read-only (`payments.view`): **do not add a route or permission that lets a
human mark a payment paid.**

**Coupon usage is claimed before the order is created**, not after — the
atomic `applyCouponUsage` guard throwing on the last remaining use must
leave nothing behind, or it would persist a discounted, stock-less ghost
order (payable, for a bKash order). `unwindOrder()` releases the use again
alongside the restock when an order is cancelled or returned, so a limited
coupon is never permanently burnt by an order that did not complete.

**Purchase batches**: `Purchase.costItems[]` is completely free-text — **no
category enum, none may be added** (a cost's identity is whatever name the
person typed; `Expense.category` is the separate, fixed-taxonomy concern for
operational spend, don't merge the two). Once `received`, a batch's cost
breakdown is immutable — correction is a new batch, not an edit. **There is
no shop/multi-shop-outlet concept** — a `Shop` model and per-Co-Admin shop
scoping existed and were deliberately removed; do not reintroduce shop
scoping without a fresh decision from the user.

**Expense edit-request pattern**: editing a confirmed/settled record follows
the same "only `super_admin` acts directly, everyone else requests a grant
through `pending_actions`" shape as stock changes and product
creation/deletion — this is the general pattern to follow for any future
"correct a finalized record" feature, not something bespoke per feature.

**Print mechanism** (`.print-area`/`.print-header`/`.print-footer` in
`globals.css`, `@page{margin:0.75in}`, triggered via
`lib/print.ts#printWithFilename(prefix)`): every "Print" action project-wide
(Expenses, Sales Report, order invoices, ...) opens the browser's own native
print dialog via `window.print()` — never a server-generated file, never a
forced direct download. `printWithFilename()` sets `document.title` to
`${prefix}-YYYY-MM-DD` (today's date, generated at click time) so Chrome
suggests that as the print/"Save as PDF" filename, deferred one macrotask
(`setTimeout`, 100ms) before calling `window.print()` — calling both in the
same tick is a known Chrome race where the dialog reads the stale title.
Print isolation MUST use `visibility: hidden`/`visible` (never `display:
none` — that permanently removes a whole ancestor subtree from rendering,
producing a blank page) and the revealed target MUST be `position: absolute`
(never `fixed` — repeats content on every page; never `static` — leaves it
wherever the invisible flow put it, causing blank pages). Every
non-print-target section on a print-enabled page needs `print:hidden` (plain
`display:none`, safe since nothing inside needs to reveal itself) or it
still reserves layout height and pads out extra blank pages — this also
covers audit/edit-trail annotations (e.g. an "edited by ... on ..." note)
that shouldn't appear on a printed record. `.print-area table/td/th/p` get
`font-size: 12pt !important` in print (normal Word-body-text size — the
on-screen admin UI runs smaller for on-screen density); headings and small
caption/label text are left alone so the printed hierarchy still reads.
Reuse `printWithFilename()` + the `.print-area` CSS mechanism for any new
print output; don't reinvent either — there is exactly one print
implementation project-wide, not a per-page one.

**PDF/export**: no PDF-generation or spreadsheet library project-wide —
every "print"/"export as PDF" (invoices, the Expenses monthly report, the
Sales Report) is the browser's own print-to-PDF via the mechanism above,
never a server-generated file. CSV export is a small hand-rolled generator
(`lib/csvExport.ts`) — no library. Match whichever pattern an existing
similar export uses; don't introduce a new approach without asking.

**Express 5 `req.query` gotcha**: `req.query` is a getter with no setter
that re-parses `req.url` on every access — plain reassignment throws, and
mutating the object silently gets discarded on next read. Any new
middleware that needs to modify `req.query` must pin it via
`Object.defineProperty(req, "query", {value, writable: true, configurable:
true, enumerable: true})` (already applied in `validate.middleware.ts`/
`sanitize.middleware.ts`).

**Boolean fields on multipart routes**: use `booleanish` (from
`validators/common.validator.ts`), never `z.coerce.boolean()` — a multipart
request sends `"false"` as a literal string, which `z.coerce.boolean()`
reads as truthy.

**`.partial()`-derived update schemas are unsafe over defaulted fields**:
Zod 4's `.partial()` makes keys optional but does **not** strip
`.default()`, so a PATCH that sends only one field silently resets every
other defaulted field. Spell out update schemas in full instead (see
`updatePurchaseSchema`, `updateShopSchema`-style comments in the
codebase) — don't derive one with `.partial()` unless every caller always
submits every field.

## Security

- Secrets live only in `.env` (gitignored) — never print/log/echo real
  credential values.
- Passwords: bcrypt via `User.model.ts`'s pre-save hook — never handle
  plaintext outside that path.
- `sanitizeRequest` (NoSQL-injection stripping) + `hpp()` run globally —
  don't bypass for new routes. All mutating routes require `authenticate`.
- **Account lockout**: 5 failed attempts → 15-minute lock (`auth.service.ts`,
  `constants/security.ts`). `PATCH /users/:id/unlock` clears it early.
- **Idle-session timeout**: staff roles only (30 min), customers exempt.
  Per-*user* (`lastSeenAt`), not per-device.
- **Impersonation** (`POST /users/:id/impersonate`, `super_admin` only):
  30-minute bearer token, no cookies touched, held client-side in
  `sessionStorage`. Impersonating another `super_admin` 403s.
- **Uploads**: multer memory storage → `uploadBufferToCloudinary()`, guarded
  by `isCloudinaryConfigured` (503 if unset). Reuse this path, don't add a
  parallel upload system. **In a staff path call
  `uploadInternalFile()`/`retireInternalAsset()` rather than the Cloudinary
  helpers directly**, so the file joins the internal upload lifecycle above —
  a raw `deleteCloudinaryImage()` in a staff path destroys a file that should
  have been recoverable.
- **Email**: always fire-and-forget — `void sendXEmail(...)`, **never
  `await`** an email send in a request path. `safeSend()` swallows/logs
  failures so callers never need to handle rejections.

## Frontend (`client/src`)

```
app/(site)/...      Customer storefront (App Router route group)
app/checkout/...     Top-level route (own layout, no storefront chrome)
app/admin/...        Admin/Co-Admin/Super Admin/Order Manager portal
app/employee/...     Employee portal
app/delivery/...     Delivery Agent portal
components/ui/       Shared primitives (Button, ProductCard, ActionButton, ...)
components/<domain>/ Feature components (checkout/, product/, admin/, account/, ...)
context/              AuthContext, CartContext, WishlistContext, ThemeContext, ...
lib/api/               One file per backend resource, built on lib/api/client.ts
lib/mappers.ts         Raw API shapes -> storefront view-model shapes
lib/permissions.ts     Manual mirror of server's permission catalogue
types/api.ts, types/hr.ts   Types mirroring backend JSON shapes
```

**Data flow convention**: never fetch raw API shapes directly in a
component — call `lib/api/*.ts`, map through `lib/mappers.ts`, then hand to
the component.

**Auth**: `AuthContext` hydrates from `GET /auth/me` (cookie-based). Admin/
Employee/Delivery routes are guarded **client-side only** via `RoleGuard` —
there is no `frontend/src/middleware.ts`; the API enforces real
authorization. `lib/api/client.ts`'s `request()` silently refreshes on a 401
and retries once (concurrent 401s share one refresh). **Session capped at 15
days** (`JWT_REFRESH_EXPIRES_IN` and `REFRESH_TOKEN_MAX_AGE_MS` must stay in
sync). While impersonating, the client sends `Authorization: Bearer` and
skips the refresh path.

**Cart & wishlist are client-side only** — `localStorage`, not synced to the
backend or the account; no server-side model. Same for Recently Viewed and
Product Comparison.

**No form or state-management library** — hand-rolled `useState`/
`useEffect` + the custom `lib/api` client. No react-hook-form, no SWR/React
Query, no Redux/Zustand. Match this for new forms/pages.

**No charting library either** — `components/admin/charts/TrendChart.tsx` is
hand-rolled SVG (`TrendChart` for grouped bars over time, `BreakdownBars` for
category shares), same reasoning as `lib/csvExport.ts`. Colors come from
theme tokens via Tailwind `fill-*`/`stroke-*` utilities so charts invert with
dark mode, exact figures ride in native `<title>` tooltips, and every chart
renders an `sr-only` data table beside it. Reuse these two for any new chart;
don't add Recharts/Chart.js/d3.

**`/admin/analytics` (Business Overview)** is composed entirely from the
existing `/reports/*` and `/finance/*` endpoints — there is no
analytics-specific API and no stored snapshot, so its numbers are by
construction the same ones Reports and Finance show. Its sales half needs
`reports.view` and its profit half `finance.view` (which Co-Admin does not
hold), and a viewer without the latter never requests cost/profit data at
all. Add a new metric by adding it to the owning report/finance service, not
by giving this page an endpoint of its own.

**Design tokens** (`app/globals.css`, Tailwind v4 `@theme`, no
`tailwind.config.js`): tokens are **role-based, not literal** —
`cream-*`/`green-*` mean "surface"/"foreground" and invert between themes;
use `bg-brand-deep` (never `bg-green-950`) for a deliberately-dark surface,
`bg-surface` (never `bg-white`) for solid cards. `@theme` must stay
non-`inline` so dark mode can override the CSS vars at runtime. No arbitrary
hex in any `.tsx` — add a token. A few token families are deliberately
**constant** across themes (`brand-deep-*`, `danger-solid`, `on-gold`,
`navbar-secondary*`, `action-*`) — don't theme-flip those.

**Dark mode** (`context/ThemeContext.tsx`): site-wide via one `data-theme`
attribute on `<html>`, not per-component `dark:` classes. Default for a
visitor with no saved preference is always **Light**, deliberately not
`prefers-color-scheme` — the server renders `<html data-theme="light">` and
the init script only overrides that when `sap:theme` is explicitly saved.
Preference persists in `localStorage` (`sap:theme`); applied before first
paint by a **plain inline `<script>`** rendered by the `app/layout.tsx`
Server Component. On Next 16 + React 19 that is emitted verbatim into the SSR
HTML and executes synchronously as the browser parses it, and React hydrates
the existing node instead of creating one.

**Do not switch this back to `next/script`.** For an *inline*
`beforeInteractive` script that component renders its own raw `<script>` from
a client component: React 19 replaces it with a `<div>` and logs "Encountered
a script tag while rendering React component", and the actual code is
deferred to Next's `self.__next_s` runtime, which runs after first paint —
reintroducing the very theme flash the script exists to prevent.

**Row actions in `/admin/*` tables** (`components/ui/ActionButton.tsx`):
**always an always-visible text label, never icon-only-with-hover-tooltip**
(not accessible/discoverable on touch devices). `tone` picks the color:
`info` (Edit/Update), `danger` (Delete/Reject/Deny), `success` (Approve/
Grant/Confirm), `neutral` (else). Reorder arrows and purely
navigational/dismiss icons are the deliberate exception and stay icon-only.

**Confirm dialogs**: use `useConfirm()` from `context/ConfirmDialogContext`
— **never `window.confirm()`**, and never `window.prompt()`-then-proceed
unconditionally (a real bug: `prompt()` returns `null` on Cancel and `""`
on empty-confirmed, and code that treated both the same kept proceeding on
Cancel). Any `prompt()`-for-an-optional-note call must explicitly check
`=== null`.

**Testing**: backend `npm test` runs Jest (unit + integration specs against
an in-memory MongoDB via `mongodb-memory-server`); frontend `npm test` runs
Vitest + React Testing Library (jsdom). Coverage is partial on both sides,
not exhaustive — no Playwright/e2e exists. **For UI changes, verify manually
in a browser** — typecheck/tests confirm correctness, not that a feature
actually works visually.

## Environment / running locally

Both apps need `.env` (see `.env.example` in each). MongoDB Atlas,
Cloudinary, and SMTP are already configured on this machine.

```
server:   npm run dev            (tsx watch, :5000, API at /api/v1)
          npm run dev:dns-fix    (tsx watch + DNS preload — see below)
          npm run build / start  (compiled dist/)
          npm run seed           (bootstrap super admin + sample staff/categories/products)
          npm run typecheck / lint / test
client:   npm run dev      (Next.js, :3000)
          npm run build / start
          npm run typecheck / lint
```

Env vars: see `server/.env.example` and `client/.env.example` (both
Zod-validated on startup, backend fails fast if a required var is
missing/malformed). Cloudinary/SMTP/Google/SMS vars are all
graceful-degrade — blank means that feature 503s or silently no-ops, not a
crash.

**DNS workaround** (`server/scripts/dev-dns-*.cjs`, **do not "fix" by
changing `config/db.ts`/`server.ts`**): this dev machine's Node resolver is
broken for `mongodb+srv://` SRV lookups. `npm run dev:dns-fix` and
`npm start` already load the preload automatically; plain `npm run dev`
does not — use `dev:dns-fix` if you hit `querySrv ECONNREFUSED`.

**Deployment routing** (`client/vercel.json`): must declare only
`"framework": "nextjs"` — **no SPA-style catch-all rewrite**. A `/(.*)  ->
/index.html` rewrite silently breaks `/product/[slug]` (the only
parameterized route), since it's matched later in Vercel's routing pipeline
than the rewrite intercepts.

## Coding rules

- Match the existing layered pattern exactly — no different style for a new
  resource.
- Gate routes with `requirePermission("some.permission")`, never a
  hardcoded role list.
- Don't reintroduce mock/static data — everything comes from MongoDB. Product
  fields (name, price, category, slug, description, images, origin, stock,
  variants, thresholds) are admin-editable at any time, so never branch on or
  hardcode one; seed values are development defaults, not business values, and
  `npm run seed` must stay idempotent (it upserts categories by slug and skips
  products whose slug already exists, so an admin's edits survive a re-run).
- **A value the business may want to change is configuration, not a constant.**
  Money, fees, thresholds and customer-facing promises live in a settings
  document — `ShippingSettings` (delivery rates/estimates), `ApprovalSettings`
  (approval thresholds), `SiteSettings` (branding/contact) — and are edited in
  the admin panel. Put a new one on the model whose domain it belongs to rather
  than inventing a fourth settings table.
  **Security and protocol constants deliberately stay in code** and must not be
  moved into the database: lockout attempts/duration, staff idle timeout, OTP
  TTL and attempt caps, impersonation token TTL, recovery-code count, rate-limit
  windows and upload size/count caps (`constants/security.ts`,
  `middlewares/`) — making these editable would hand anyone with
  `settings.manage` a way to weaken authentication. Likewise the bKash timing
  constants in `payment.service.ts`, which track the gateway's own session
  semantics rather than a business choice.
- Keep `lib/api/*.ts` thin (fetch call + types only) — business logic
  belongs in the backend service layer.
- Never `await` an email send in a request path.
- A new route reading `req.query` must go through `validate({query: ...})`.
- Don't call the homepage/hero-slide system a general "CMS" — it's a fixed
  set of known section types, not arbitrary page/block creation.
- Don't add a fixed category/type enum to `Purchase.costItems[]`.
- Don't reintroduce a `Shop`/multi-shop-outlet model without a fresh
  decision from the user.
- Call `recordAuditLog()` for any new sensitive action not already covered
  by `InventoryLog`/`Order.statusHistory` — it never throws, always safe.
- No new UI/form/state-management library without asking first.

## Known limitations (verified, not exhaustive)

- Permission catalogue is code (new key = code change); roles are data (new
  role = no code change).
- Role/permission cache is per-process — a multi-instance deploy needs a
  restart per instance to pick up an edit. Current Render setup is
  single-instance, unaffected.
- A custom role only adds permissions, never subtracts — no per-user deny
  list.
- Approved Exchange requests aren't auto-fulfilled — no replacement-order
  automation; a staff member handles the swap manually.
- bKash is implemented end-to-end but inactive until `BKASH_*` credentials
  are provisioned (the storefront hides the option and the API 503s until
  then). `nagad` remains UI-only with no gateway behind it.
- An unpaid bKash order holds its stock and coupon use until someone
  cancels it — there is no automatic expiry job for abandoned payments.
- The approval-gate system covers only its fixed list of action types (see
  above) — role/settings/content changes are audit-logged but not
  gate-routed. Campaign approval is a separate lifecycle on `Campaign`
  itself, not a `PendingAction` type.
- No SMS gateway connected — `sendSms` is a gateway-ready no-op abstraction;
  delivery OTP and campaign SMS both degrade gracefully (email/other
  channels still work).
- A purchase batch's cost is never summed into `totalExpensesBDT` — only the
  portion that actually sold enters the P&L, as cost of goods sold. That is
  what keeps stock purchases from double-counting against manually-logged
  expenses while still charging real product cost against profit. Unsold
  stock shows up in `getInventoryValuation()` instead.
- COGS is a partial total when an item sold with no purchase-batch history
  behind it; `ordersWithUnknownCostBasis` reports how many orders that
  affects rather than letting the gap read as a zero-cost sale.
- A received purchase batch's cost breakdown is immutable — no edit/
  reversal/delete; correction is a new batch.
- Two queued stock changes to the same variant aren't locked against each
  other — both apply in grant order; the reviewer is warned, not blocked.
- No `client/src/middleware.ts` — route protection is client-side
  (`RoleGuard`) plus real backend authorization.
- SMS is wired end-to-end but inactive (no provider provisioned). Google
  Sign-In is live: it is the Google Identity Services ID-token flow, so the
  server only ever needs `GOOGLE_CLIENT_ID` (the client secret is not part of
  this flow), and the same value must be set as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
  on the client or the button hides itself. Any new deployment origin must be
  added to the OAuth client's **Authorized JavaScript origins** — redirect
  URIs are not used by this flow.
- No arbitrary page/route creation anywhere — every admin-editable surface
  (homepage, static pages, nav, footer) is a fixed, known type.

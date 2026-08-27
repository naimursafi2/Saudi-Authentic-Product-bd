# Saudi Authentic Product

A full-stack e-commerce platform for premium Saudi & Madinah dates and
heritage products, delivered across Bangladesh — plus internal Admin,
Co-Admin, Super Admin, Order Manager, Employee, and Delivery Agent portals
for running the business. Currency is displayed in BDT and shipping uses
Bangladesh districts — intentional, since the storefront targets
Bangladesh.

```
Saudi-Authentic-Product/
├── server/      Express 5 + TypeScript + Mongoose REST API
├── client/      Next.js 16 (App Router) + React 19 + TypeScript
├── .gitignore   Shared by both apps
├── README.md    You are here
└── CLAUDE.md    Architecture, conventions & rules for AI coding agents
```

For the deeper architectural map (full route/model tables, layering
conventions, auth flow, data mapping, known framework gotchas, and known
limitations) see **[CLAUDE.md](./CLAUDE.md)** — this README is kept in sync
with it but stays higher-level.

## Tech stack

**Backend** — Express 5, TypeScript, MongoDB/Mongoose, Zod validation, JWT
(httpOnly cookies), Cloudinary (image uploads), Nodemailer (SMTP), Jest.

**Frontend** — Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4
(CSS-first `@theme`, no `tailwind.config.js`), lucide-react icons,
self-hosted fonts (EB Garamond + Plus Jakarta Sans via `@fontsource`). No
form or state-management library — forms/data fetching are hand-rolled with
`useState`/`useEffect` and a small custom `lib/api` fetch client.

## Features

- **Customer storefront** (`client/src/app/(site)`): home, shop (filterable
  catalog), product detail (a multi-photo gallery with thumbnails below the
  main image, a cursor-following hover-zoom, and a click-to-open fullscreen
  lightbox — dark backdrop, close/prev/next, its own thumbnail strip,
  Escape and arrow-key navigation, click-outside-to-close — variant/quantity
  selection,
  a wishlist toggle alongside a 2x2 Add to Cart/Buy Now/Order on WhatsApp/
  Call for Order action grid — colors from dedicated `--color-action-*`
  tokens, WhatsApp/Call sourced from `SiteSettings.contactPhone` with a
  dynamically-generated pre-filled message, not hardcoded — reviews,
  delivery info, related products), categories, offers (discounted
  variants), cart,
  wishlist, a sidebar-driven account dashboard (login/register; a persistent
  nav — Dashboard/My Orders/Wishlist/Address/Manage Profile/Logout — next to
  stat cards, recent-orders and wishlist-preview panels, profile photo
  upload via Cloudinary, editable name/phone/password, a full address
  book with add/edit/delete/set-default, and a visual order-status timeline
  per order — shared with the public tracking page below), password reset, a
  public order-tracking page (`/track-order` — look up any order by order
  number + checkout email, no login required, auto-prefilled for signed-in
  customers, showing a full step-by-step delivery timeline and — while an
  order is out for delivery — the one-time code to share with the delivery
  agent), about, contact, shipping policy — all three admin-editable
  via the `StaticPage` content system (contact's phone/email still sourced
  separately from the admin-editable `SiteSettings` singleton) — and a
  plain static FAQ page (`/faq`, hardcoded Q&A content, not part of the
  `StaticPage` system) — plus a standalone `/checkout`
  flow with a coupon-code field (server-validated discount preview, applied
  total, never a client-trusted amount) — all backed by the live API and
  Cloudinary imagery. The navbar shows
  a personalized "My Account" entry (account icon + the signed-in
  customer's first name) that links straight into the dashboard, replacing
  the Sign In prompt shown to logged-out visitors. Cart and wishlist are
  **client-side only**
  (`localStorage`), not synced to the account or across devices — there is
  no server-side cart/wishlist model.
- Secure authentication (JWT via httpOnly access/refresh cookies — the
  frontend API client silently refreshes and retries once on a 401 rather
  than signing the user out mid-session, only dropping the session if the
  refresh itself fails — logout-all via token versioning), and role +
  permission based access control (see the next bullet) across seven built-in
  roles: `customer`, `employee`, `delivery_agent`,
  `co_admin`, `order_manager`, `admin`, `super_admin`. Registration enforces
  a strong-password policy (8+
  characters, upper + lower case, a digit) with a live strength meter and a
  required confirm-password match, checks both email *and* phone for
  duplicates, and can save an optional first delivery address in the same
  request. Every account verifies its email (a timed link emailed on
  signup/staff-creation, `/account/verify-email`, with resend — plus a
  "Verify Email"/"Email Verified" indicator on every role's profile page);
  only Google Sign-In and seeded/bootstrap accounts are exempt (already
  verified by construction). Being unverified only blocks a `customer` from
  placing orders or posting reviews — staff are never locked out of their
  portal by it. A single Sign In / Register / Forgot Password form (`/account`) serves
  every role — there's no separate staff login page. Forgot/reset password
  is one flow that works identically for all seven roles: a time-limited,
  single-use emailed link that invalidates itself (and every other active
  session) once used. Optional "Continue with Google" sign-in/registration
  is wired end-to-end via Google Identity Services (`POST /auth/google`,
  `google-auth-library`) but stays inactive — button hidden, endpoint 503s —
  until a `GOOGLE_CLIENT_ID` is configured (see Environment variables).
- **Admin / Co-Admin / Super Admin / Order Manager portal**
  (`client/src/app/admin`, fully built): dashboard (live stats), products
  (a whole new product from Admin or Co-Admin is queued for Super Admin
  approval and doesn't exist until granted — only Super Admin publishes
  directly; deletion is Super-Admin-direct / Co-Admin-request-only — Admin
  has no product-deletion access at all), categories, orders (including assigning
  a delivery agent once an order is ready for dispatch), refunds (Order
  Manager review, then Admin/Super Admin financial approval), coupons
  (percentage/fixed discounts, scheduling window, minimum order amount,
  usage limit — reachable by co_admin too, with large-percentage discounts
  routed through the approval-gate system below), customers, reviews,
  employees, attendance, leave, tasks (categorized by task type),
  performance, salary & payments (admin/super_admin only), inventory (stock
  adjustments + audit log), purchases (purchase batches with unlimited
  custom cost items and automatic landed-/unit-cost maths), shops (sourcing
  outlets plus per-staff shop assignment), reports (sales summary), finance (revenue/
  expense/investment/profit-loss summary, admin/super_admin only),
  investments (append-only investor ledger, admin/super_admin can view,
  super_admin can record), expenses (co_admin can submit — auto-confirmed
  for admin/super_admin, pending confirmation otherwise), approvals (the
  Grant-Based Approval Workflow queue plus editable thresholds, super_admin
  only), audit logs (read-only sensitive-action history, scoped to the
  viewer's own actions for everyone except admin/super_admin), homepage
  content (hero slides + homepage sections, admin/super_admin only),
  navigation (header nav links, admin/super_admin only), footer (footer
  link columns, admin/super_admin only), pages (About/Contact/Shipping
  Policy body copy, admin/super_admin only), site settings (name/
  announcement/contact/footer/social links are admin/super_admin only, but
  the company logo specifically can also be uploaded by co_admin), and
  roles & permissions. Route access is guarded client-side
  (`RoleGuard`, which admits a user by built-in role *or* by any admin-panel
  permission, so a custom role gets in) and enforced for real by the
  backend's `requirePermission(...)` on every route; every page whose API the
  current user cannot reach shows a friendly "Access restricted" state when
  navigated to directly instead of a broken page shell. The sidebar filters
  itself by permission, so `order_manager` reaches the same `/admin` shell
  but sees only Dashboard, Orders, Refunds, and Audit Logs — a real
  least-privilege role, not the full admin-tier surface — and a custom role
  automatically gets exactly the menu its permissions justify.
- **Roles & permissions** — every API route is gated by a granular
  permission (`products.edit`, `orders.manage`, `salary.view`, …) rather than
  a hardcoded list of role names, and each role's permission list lives in the
  database. The seven built-in roles are seeded with permission sets
  transcribed from the role matrix they replaced, so nothing about their
  access changed. Beyond them, an authorised user can create **custom roles**
  from `/admin/roles` — VIDEO_EDITOR, DIGITAL_MARKETER, CONTENT_MANAGER,
  anything — pick their permissions from a grouped checkbox list, and assign
  one to a staff member from the Employees page's **Access** panel, all with
  no code change and no redeploy. A custom role *adds* permissions on top of
  a user's built-in role and never removes them. Guards worth knowing: nobody
  can grant a permission they don't hold themselves, only a Super Admin can
  re-permission a built-in role, the Super Admin role always holds everything
  and can't be edited, and a role still assigned to somebody can't be deleted.
  Every role change is audit-logged, and a permission edit takes effect on the
  affected user's next request — no re-login. The admin panel hides menu items
  and pages a user can't use, but that is presentation only: the backend
  re-checks every permission on every request.
- **Approval-gate system (Grant-Based Approval Workflow)** — a single
  reusable `PendingAction` queue gates nine sensitive action types (**a whole
  new product created by anyone other than a Super Admin** — the product
  doesn't exist at all until granted, coupon create/update above a
  configurable discount size, product deletion by co_admin, **every stock
  change to an existing product by anyone other than a Super Admin** — both
  the manual inventory adjustment and the stock fields on the product form,
  refund requests by co_admin, refund approvals above a
  configurable amount by admin, expense confirmation above a
  configurable amount by co_admin, and receiving a purchase batch that moves
  stock): the initiating request returns `202 {pendingActionId}` instead of
  applying immediately, a super_admin reviews it at `/admin/approvals` and
  grants (applies the original payload verbatim) or denies it, and both the
  requester and every super_admin get emailed at the relevant step. The four
  thresholds that decide what gets auto-approved vs. gated are stored in a
  single `ApprovalSettings` singleton, editable only by super_admin — never
  hardcoded.
- **Stock control** — stock lives in exactly one place (`Product.variants[].stock`)
  and every surface reads it live: the storefront, product listings, the
  admin portal, and a read-only Stock Levels page in the employee portal for
  warehouse/stock-checking work. Zero stock shows a **Stock Out** badge
  instead of a number and disables Add to Cart / Buy Now. Changing it is
  Super-Admin-only: an Admin's or Co-Admin's adjustment — whether made on the
  inventory page or through the stock fields on the product form — is queued
  for approval and the visible count does not move until it's granted, at
  which point it applies immediately and writes the usual inventory-history
  entry (who, delta, resulting balance, timestamp). A single product save can
  therefore publish a description change instantly while its stock change
  waits. Automatic stock movement from orders, cancellations and returns is
  never gated. Saving a product preserves each variant's identity, so an
  unrelated edit no longer orphans the variant reference stored on existing
  cart lines and orders. When two pending requests would change the same
  variant's stock, the approvals queue flags both with a conflict badge and
  warns before granting, and the grant is recorded in the audit log as having
  raced another request.
- **General audit logging** — every sensitive mutation (role/status changes,
  coupon create/update/delete, a Super Admin's direct product
  creation/deletion plus every grant of a gated one, **product content
  edits such as title and description — these apply immediately and are
  logged rather than approval-gated**, approval-settings edits,
  and every approval-gate grant/deny) writes an append-only `AuditLog`
  entry (actor, role, action, resource, before/after values, optional
  note), visible at `/admin/audit-logs` — scoped to the viewer's own
  actions unless they're admin/super_admin. The page translates every raw
  value before showing it: a colored badge with a plain-language label
  instead of `product.stock.update.grant` ("Stock Update Approved"), the
  affected product/coupon/user/shop's actual name instead of
  `PendingAction #764b74`, and a friendly note (backend-provided, or
  synthesized for the handful of actions that don't usually carry one) —
  raw ids still exist for tracing but only as a small muted fragment next
  to the friendly name, never as the headline.
- **Employee portal** (`client/src/app/employee`, fully built):
  check-in/out + attendance history, tasks (filterable by type — packing,
  product counting, stock checking, warehouse, customer support, data entry,
  product preparation), a read-only Stock Levels page showing the same live
  per-variant counts the storefront does, leave requests, performance
  history, salary/payment history (base + an optional daily allowance line
  item, both entered manually the same way the rest of a payment is), and a
  profile page (avatar, address, and — for staff only — a read-only NID
  number/card-photo card; an admin sets both from `/admin/employees`).
- **Printable order invoice** — a "Print Invoice" action on both
  `/admin/orders`' order-detail view and the customer account portal's
  Order History opens a clean, black-on-white invoice (company logo/name,
  billed-to, itemized products, subtotal/shipping/discount/total, payment
  status) with a "Print" button; print-only CSS isolates just that content
  from the rest of the page, including the modal it's shown in.
- **Consistent CRUD action styling** — every Edit/Update/Delete/Approve/
  Reject/Remove-style action across every portal (admin, employee, delivery,
  and customer-facing pages like the cart and checkout) renders as a
  pill-shaped chip with a real background at rest — light blue for Edit,
  light red for Delete/Reject/Remove, light green for Approve/Confirm/
  Save — that deepens on hover, never bare colored text. Icon-only actions
  also get a hover/focus-reveal tooltip alongside their `aria-label`.
  `window.confirm()`/`window.prompt()`-then-proceed is gone everywhere too,
  replaced by a shared, styled Confirm Dialog (`useConfirm()`) — fixing a
  real bug where cancelling the "reason" prompt on Reject/Deny/Cancel
  actions still went ahead and rejected/denied/cancelled the record anyway.
- **Delivery portal** (`client/src/app/delivery`, fully built, `delivery_agent`
  role only — structurally excluded from `/admin`): a dashboard of assigned-
  order counts, an assigned-orders list with a detail view for marking an
  order picked up / out for delivery, a **Send Delivery OTP** button once
  out for delivery, an OTP-entry field with a **Verify & Confirm Delivery**
  button and a **Resend OTP** link once a code is outstanding, or recording
  a failed-delivery reason, plus the same profile page as Employee.
- **Order & delivery workflow** — a 14-status pipeline (`pending` →
  `confirmed` → `processing` → `packed` → `ready_for_dispatch` →
  `assigned_to_agent` → `picked_up` → `out_for_delivery` → `otp_verified` →
  `delivered`, plus `delivery_failed`/`cancelled`/`returned`/`refunded`)
  replacing the old flat 5-status enum. Every transition is validated
  against an explicit adjacency table and role-gated (Order Manager/Co-Admin
  drive the pre-dispatch steps and assignment; only the assigned Delivery
  Agent can drive pickup through delivery; refunds are Admin/Super-Admin
  only); every status change records who made it, their role, the previous
  status, and an optional note. Reaching out-for-delivery no longer sends an
  OTP by itself — the agent sends one explicitly, once they've actually
  reached the customer, via its own endpoint. Each send/resend generates a
  fresh one-time **4-digit** code (5-minute expiry, invalidated after 5
  wrong attempts) emailed to the customer, SMS-ready once a gateway is
  configured (see Known limitations), and also shown on their own
  order-tracking/account page in the meantime; the delivery agent never sees
  the code in their own portal and must collect it from the customer to
  confirm delivery — there is no way to mark an order delivered other than
  through a successful OTP verification, which also stamps
  `deliveryVerified`/`deliveredAt`/`deliveredBy` on the order.
- **Finance module (Investment, Expense, Refund, Profit/Loss)** — an
  append-only `Investment` ledger; an `Expense` log (12 categories,
  auto-confirmed for admin/super_admin, pending confirmation for co_admin
  above a configurable threshold); a `Refund` workflow (customer/staff
  request on a `returned` order → Order Manager review → Admin/Super Admin
  financial approval, gated by amount for Admin, with an auto-created
  confirmed `Expense` on approval and the order flipped to `refunded`) —
  customers request one themselves from the My Orders tab of their account
  dashboard, which also shows the live status of a refund they've already
  requested; and
  a finance summary (`/admin/finance`) combining live order revenue (reused
  from the existing sales-report calculation, not duplicated), total
  investment, total confirmed expenses (by category), and net profit/loss —
  all admin/super_admin only.
- **Purchasing with fully flexible additional costs** — every purchase is
  recorded as its own batch (shop, optional catalogue product/variant,
  supplier, quantity, product cost) and carries **any number of custom cost
  items**, each just a name you type yourself, an amount, an optional note
  and an optional receipt photo. There is deliberately **no fixed list of
  expense types**: a dates batch might carry Shipping, Customs and
  Transport, a watch batch Parts, Repair and a Supplier Fee, and a future
  product something else entirely — all with no code change. The system
  computes `Product Cost + all custom costs = Total Landed Cost` and
  `Total Landed Cost / Quantity = Actual Unit Cost` on every read, so the
  numbers can never drift from the cost list beside them, and each batch is
  kept separately (with a weighted average across batches) so a price rise
  between shipments stays visible instead of being averaged away. Receiving
  a batch that is linked to a catalogue variant adds its quantity to live
  stock **through the existing Super-Admin approval gate**, exactly like
  every other stock change; a batch with no catalogue link (packaging,
  consumables) is simply marked received. Once received, a batch's cost
  breakdown is immutable — a correction is a new batch. Super Admin sees and
  manages everything; Co-Admin is scoped server-side to the shops assigned
  to them, on reads and writes alike, and sees nothing at all until someone
  assigns them one.
- **Homepage content management** — admin-editable hero slides (image,
  plus a title/subtitle/CTA pair kept only as an internal admin-table label
  — the storefront hero is image-only, see below) and a fixed set of nine
  homepage section types (hero, trust strip, featured categories, best
  sellers, product story, customer reviews, promo banners, product
  showcases, homepage carousel banners). All active slides render on the
  homepage as a single-image carousel: autoplay every 4.5 seconds, one image
  visible at a time, previous/next arrows hidden until the banner is
  hovered or focused, pagination dots below the image, swipe on touch
  devices, pause on hover or focus, and a restarted timer after any manual
  navigation so the carousel never jumps straight off the slide the visitor
  just chose. It is skipped for viewers who prefer reduced motion. Slides
  are added, edited, reordered and enabled/disabled from `/admin/homepage`
  by Admin, Super Admin and Co-Admin; deleting one is Admin/Super Admin
  only. Nothing about a slide's image is hardcoded in the frontend. Seeded
  with two starter "Premium Dates" slides on `npm run seed`. The six
  singleton sections are
  visibility/order-editable only (the trust strip's benefit items —
  icon + label — are individually editable/reorderable/toggleable); promo
  banners and product showcases can be freely created/deleted. A product
  showcase pulls a configurable product grid (by category, best sellers,
  new arrivals, or on-sale) — this is how sections like "Premium Dates" or
  a future Watches/Chocolates showcase get added with no code change. A
  fourth freely-creatable type, homepage carousel banners, still exists as
  an admin-manageable type (create/edit/reorder/delete, seeded with three
  starter "Premium Dates" banners on `npm run seed`) but is **not currently
  rendered on the storefront homepage** — its section switch has no case
  for that type, since displaying it duplicated the hero carousel's own
  images directly beneath it.
- **Navigation & footer content management** — the header's top-level nav
  links and the footer's link columns (`/admin/navigation`, `/admin/footer`)
  are freely add/edit/delete/reorder-able, same pattern as hero slides; the
  footer's social icons come from a `socialLinks` list on the same
  `SiteSettings` singleton as the logo/announcement/contact fields
  (`/admin/settings`).
- **Dark / light mode** — a toggle in the storefront header and in each
  portal shell, applied site-wide (storefront, admin, employee, delivery).
  The choice persists in `localStorage` (`sap:theme`); a visitor with no
  saved preference always gets **Light**, regardless of their OS/browser
  setting — an inline pre-hydration script only overrides the `<html>`
  tag's static `light` default when a saved `dark`/`light` value actually
  exists, which is also what gives a returning dark-mode visitor no white
  flash. Implemented by redefining the palette variables under
  `[data-theme="dark"]` in `app/globals.css` rather than per-component
  `dark:` classes.
- **Two-row storefront header** — a database-driven company logo (uploaded
  via `/admin/settings`, `SiteSettings.logo`, with a static day-one fallback
  until one is uploaded — no site-name text alongside it) + search bar +
  labelled action icons (Track Order / Wishlist / Cart / account) on the top
  row, the admin-managed nav links and Categories dropdown on the second. The
  second row is a fixed premium emerald (`#003b2f`) + gold (`#d4af37`) pill
  bar — cream nav text, a lighter-emerald + gold hover, a gold pill for the
  active page, all on a smooth ~200ms transition — that deliberately does
  **not** follow the site's light/dark toggle (unlike the rest of the
  header), mirrored into the mobile drawer below `lg` so each nav link keeps
  the same emerald/gold pill treatment there too. The row also ends in a
  "More" dropdown (About Us / Wishlist / FAQs / Call Us / WhatsApp) — a
  fixed structural menu, same convention as the Categories dropdown beside
  it, not admin-editable; Call Us/WhatsApp read `SiteSettings.contactPhone`
  and don't render (or render disabled, on the product page's action
  buttons) until an admin sets one. Collapses below `lg` into
  a left-hand drawer with the search bar on its own row. A signed-in user is
  shown as their uploaded avatar, or a monogram
  fallback. "Sign In" is the single auth entry point — registration is
  reached from the sign-in form's own tabs and its "Don't have an account?
  Sign up" link.
- **Announcement strip** — the thin green bar above the main navbar (for
  occasions like Eid or a sale) is opt-in and **off by default**. Admin and
  Super Admin switch it on/off and edit its text together at
  `/admin/settings` (`announcementEnabled` + `announcementText` on
  `SiteSettings`), so running a seasonal message needs no code change or
  redeploy. It stays hidden while the text is blank, even when switched on.
  Co-Admin cannot reach the rest of site settings (it can only update the
  logo, see above), so cannot toggle it.
- **Static page content management** — `/admin/pages` edits the body copy of
  the three static informational pages (`/about`, `/contact`,
  `/shipping-policy`) via a `StaticPage` model: one fixed, lazily-seeded
  document per page type (editable, not creatable/deletable), covering hero
  title/intro text/hero image, a reorderable `blocks[]` list (About's value
  highlights with an icon picker, or Shipping Policy's policy sections, each
  independently visible), and About's closing CTA banner. Contact's
  phone/email/social links still come from `SiteSettings`, not duplicated
  here. This and the homepage system above are **not** a general CMS or page
  builder — every editable surface is a fixed, known type; there's still no
  arbitrary page/route creation.
- **Security hardening** — optional TOTP two-factor authentication for any
  account (authenticator-app enrolment with a QR code, eight single-use
  recovery codes, a code-entry step at login, self-service disable behind a
  password check); automatic account lockout for 15 minutes after 5 failed
  password attempts, with an admin "Unlock" action on the Customers and
  Employees pages; a 30-minute idle-session timeout enforced for staff roles
  only (customers are deliberately exempt so an idle storefront session
  isn't killed mid-shop); and Super-Admin support-login (impersonation) —
  a short-lived, non-refreshable bearer token that acts as the target user
  while leaving the Super Admin's own session intact underneath, shown
  behind a persistent banner and recorded in the audit log. Impersonating
  another Super Admin is refused.
- SMTP email notifications (fire-and-forget, never block a request): order
  confirmations, staff welcome, leave status, task assignment, password
  reset, email verification, delivery OTP, approval-gate requests/outcomes,
  account-lockout warnings, and salary/payment notices (paid or
  pending-reminder copy). Three operational alerts fan out to the staff
  roles that own the workflow: a new order (order manager/co-admin/admin/
  super admin), a variant crossing its low-stock threshold (co-admin/admin/
  super admin, fired only on the crossing so a persistently low variant
  doesn't email on every sale), and a failed delivery (order manager/
  co-admin/admin/super admin). This is not a full notification matrix —
  there's no per-user subscription model and no in-app inbox.

## Getting started

Requires Node.js 20+ and a MongoDB connection string.

### 1. Backend

```bash
cd server
npm install
cp .env.example .env   # fill in MongoDB, JWT secrets, Cloudinary, SMTP
npm run seed            # creates a super admin + sample staff, categories, products, homepage sections
npm run dev              # http://localhost:5000 (API at /api/v1)
```

For a production-style run (compiled JS instead of `tsx watch`):

```bash
npm run build            # tsc -> dist/
npm start                # runs dist/server.js, http://localhost:5000
```

> On machines affected by the local DNS resolver bug described in
> `server/scripts/dev-dns-preload.cjs` (SRV lookups for `mongodb+srv://`
> failing with `ECONNREFUSED` even though normal DNS works), both
> `npm run dev:dns-fix` and `npm start` already load that DNS preload
> automatically — no manual `NODE_OPTIONS` needed. `npm run dev` does not,
> so use `npm run dev:dns-fix` instead of `npm run dev` if you hit that bug
> in watch mode. It's a machine-local workaround (a stale Windows
> network-adapter registry entry, not an app/Atlas/network problem), not a
> real fix — see the comment in that file for details.

### 2. Frontend

```bash
cd client
npm install
cp .env.example .env    # NEXT_PUBLIC_API_URL (defaults to http://localhost:5000/api/v1)
npm run dev              # http://localhost:3000
```

Seeded login (see `server/src/seed/seed.ts` for the full list): a super
admin from your `.env`, plus sample `admin`, `co_admin`, and two `employee`
accounts, all with password `Employee123!`.

## Scripts

Run from inside `server/` or `client/` respectively:

| Script                | Backend | Frontend |
| --------------------- | ------- | -------- |
| `npm run dev`          | ✅ tsx watch | ✅ Next dev server |
| `npm run dev:dns-fix`  | ✅ tsx watch + DNS preload | — |
| `npm run build`        | ✅ tsc → `dist/` | ✅ production build |
| `npm run start`        | ✅ run built `dist/` + DNS preload | ✅ run production build |
| `npm run typecheck`    | ✅ `tsc --noEmit` | ✅ `tsc --noEmit` |
| `npm run lint`         | ✅ ESLint | ✅ ESLint |
| `npm test`             | ✅ Jest (unit + integration, see Testing below) | ✅ Vitest + RTL (`npm run test:watch` for watch mode) |
| `npm run seed`         | ✅ bootstrap DB | — |

`npm start` and `npm run dev:dns-fix` both load `server/scripts/dev-dns-preload.cjs`
automatically (see the note above) — no manual `NODE_OPTIONS` needed on this
machine.

## Testing

- **Backend**: `npm test` runs Jest (`server/jest.config.js`, ts-jest) over
  `server/src/tests/*.test.ts` — 10 unit-style specs covering `ApiError`,
  app bootstrap, the `booleanish` zod helper, `notFoundHandler`, JWT utils,
  `paramStr`, the RBAC middleware — both `authorize` (including the
  `order_manager`/`delivery_agent` roles) and `requirePermission`, plus the
  built-in roles' default permission sets — shipping-fee calculation,
  `slugify`, and the `validate` middleware — plus `server/src/tests/
  integration/*.integration.test.ts`, real end-to-end HTTP specs (auth,
  catalog RBAC/creation, order creation/stock/tracking, the full order status
  pipeline including RBAC/self-scoping/OTP for the delivery workflow,
  task-type categorization, coupon discount-size gating through the
  approval system, the approval-gate/audit-log engine — product-deletion
  RBAC, grant/deny flows, threshold-setting edits — and the full Finance
  module — investment/expense RBAC, expense over-threshold approval-gating,
  a complete refund request→review→approve walk through a real `returned`
  order, a customer-initiated refund request with per-customer list scoping,
  and finance-summary math — plus the security-hardening suite: account
  lockout/unlock, TOTP enrolment and login challenge, recovery-code
  single-use, staff-vs-customer idle-session timeout, and impersonation
  RBAC; the operational-notification fan-out, asserting which staff
  roles each alert targets; and the stock-approval suite — that live stock
  and inventory history stay untouched until a Super Admin grants, that a
  deny leaves them untouched, that Admin is gated too, that a queued delta is
  re-evaluated against stock that moved while it waited, that one product
  save can ship a description edit while holding its stock change, that
  employees can read stock but not change it, that variant ids survive
  unrelated edits while foreign ids are ignored, that overlapping pending
  requests are flagged symmetrically and clear once resolved, and that
  title/description edits apply immediately with field-level old/new audit
  entries; the homepage banner carousel — active-only public listing, RBAC,
  and the one-field-PATCH cases behind slide reorder and enable/disable; and
  the role/permission system — that each built-in role's effective
  permissions equal its documented defaults, that a custom role grants real
  API access and stops the moment it is deactivated, that an Admin cannot
  grant a permission they lack or re-permission a built-in role, that a Super
  Admin's edit applies on the very next request, and that built-in or
  still-assigned roles cannot be deleted); and the purchasing module — the
  landed-cost maths over arbitrarily-named cost items (including two batches
  whose cost vocabularies share nothing), totals recomputing as costs are
  added and removed, per-batch history with a weighted average unit cost,
  receipt through the stock approval gate for both Super Admin and Admin, an
  unlinked batch receiving without touching stock, a received batch refusing
  further cost edits, and shop scoping — a scoped viewer failing closed with
  no assignment and unable to widen scope with a `?shop=` filter — run with
  `supertest` against an actual in-memory MongoDB via
  `mongodb-memory-server`. 198 tests across 27 suites passing as of the
  purchasing build. Coverage is still partial, not exhaustive.
- **Frontend**: `npm test` runs Vitest (`vitest.config.mts`, jsdom
  environment) with React Testing Library. Covers pure-logic modules
  (`lib/utils`, `lib/passwordStrength`, `lib/mappers`, `lib/stock`), one
  component (`PasswordStrengthMeter`), the admin sidebar's permission
  filtering (`AdminNav` — that each built-in role's menu is unchanged and a
  custom role gets exactly the items its permissions justify), and
  `CartContext` (add/remove/quantity/localStorage persistence, with
  `lib/api/products` mocked). No
  Playwright/e2e browser testing exists — verify visual/UI changes manually
  in a browser.

## Environment variables

Each app documents its own variables in `server/.env.example` and
`client/.env.example` — copy them to `.env` and fill in real values.
Never commit `.env` files; the root `.gitignore` already excludes them.

**Backend** (`server/.env.example`, validated by a Zod schema in
`src/config/env.ts` — the app fails fast on startup if a required var is
missing/malformed):

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | runtime mode (`development`/`production`/`test`) |
| `PORT` | HTTP port (default `5000`) |
| `API_PREFIX` | base path for all routes (default `/api/v1`) |
| `CLIENT_ORIGIN` | allowed CORS origin(s), comma-separated |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_EXPIRES_IN` | access token signing secret / TTL |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN` | refresh token signing secret / TTL (default `15d` — after this a real login is required, silent refresh no longer works) |
| `COOKIE_DOMAIN` | domain for the auth cookies |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | image uploads; blank → upload endpoints return 503, rest of the app still works |
| `SMTP_SERVICE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | staff/customer email notifications; blank → sends become a silent logged no-op |
| `GOOGLE_CLIENT_ID` | Google Sign-In OAuth Client ID; blank → `/auth/google` returns 503 and the frontend button stays hidden. Not a secret — see `server/.env.example` for how to obtain one |
| `SMS_API_URL` / `SMS_API_KEY` / `SMS_SENDER_ID` | delivery-agent OTP SMS gateway (`src/config/sms.ts`); blank (the default — no provider is integrated) → sends become a logged no-op, the OTP still reaches the customer by email and the tracking/account page |
| `SEED_SUPER_ADMIN_NAME` / `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` | bootstrap super-admin account used by `npm run seed` |

**Frontend** (`client/.env.example`):

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | backend API base URL including prefix; defaults to `http://localhost:5000/api/v1` if unset |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | must match the backend's `GOOGLE_CLIENT_ID`; blank hides the "Continue with Google" button |

## Known limitations

- Test coverage is basic on both sides (a handful of backend integration
  specs, a handful of frontend Vitest specs) — not comprehensive. No
  Playwright/e2e browser testing exists. See Testing above.
- No payment gateway integration — `bkash`/`nagad` are selectable at
  checkout and stored as the order's `paymentMethod`, but nothing actually
  charges the customer, verifies a payment signature, or flips
  `Order.isPaid` for them; only a `cod` order that reaches `delivered` gets
  marked paid. Treat non-COD checkout as UI-only until a real gateway is
  wired up.
- The approval-gate system covers a fixed, spec-defined list of ten action
  types (coupon create/update, product creation, product deletion, product
  stock update, inventory adjustment, refund request/approval, expense
  confirmation, purchase receipt) —
  role changes, settings changes, product content edits, and other
  sensitive actions are audit-logged but do not go through the
  grant/deny `PendingAction` queue.
- Purchase costs are not fed into the finance summary — `/admin/finance`
  still totals confirmed `Expense` documents only, because auto-logging a
  batch's landed cost there would double-count anything the user also
  recorded as an expense. Landed cost is per-batch cost accounting; the
  finance summary is operational spend.
- A purchase's cost breakdown is immutable once the batch is received —
  there is no edit, reversal or delete, and the intended correction is a new
  batch. A wrong received quantity is fixed through the normal inventory
  adjustment gate, and the purchase keeps the number it was received with.
- Shop assignment is per user and additive only — there is no per-shop deny
  list and no "every shop except one"; unrestricted access is all-or-nothing
  via the `shops.manage` permission.
- Two queued stock changes to the same variant are flagged for the reviewer
  but not locked — both still apply in grant order (deltas compose; absolute
  updates are last-grant-wins). Nothing blocks the grant or auto-supersedes
  the second request; resolving the overlap is a human decision.
- Two-factor authentication is opt-in per account, not enforceable — there's
  no admin setting to require it for staff roles, and no admin-side reset if
  a user loses both their authenticator and every recovery code (the only
  recovery is a database edit).
- The idle-session timeout is per-user, not per-device: it's driven by a
  single `lastSeenAt` on the user document, so activity in one browser keeps
  every session for that account alive. There is no session list or
  per-device revocation beyond the existing all-sessions logout.
- Notification coverage is deliberately partial — three operational events
  (new order, low stock, delivery failure) plus the approval-gate and
  transactional emails. There is no per-user notification preference model,
  no in-app notification inbox, and no digest/batching, so a busy day means
  one email per order to every order-owning staff account.
- Cart and wishlist are `localStorage`-only; they don't persist server-side
  or follow a customer across devices/browsers.
- The admin sidebar hides items the current user has no permission for, and
  the layout's guard still admits every admin-tier role at the route level —
  so `/admin/salary`, `/admin/finance`, `/admin/investments`,
  `/admin/navigation`, `/admin/footer`, `/admin/pages`, `/admin/settings` and
  `/admin/approvals` each check the relevant permission themselves and show a
  friendly "Access restricted" state instead of attempting to load data.
  Navigating there directly no longer produces a broken page shell with
  failed API calls.
- Adding a brand-new *permission* still needs a code change (the key must be
  added to the catalogue and referenced by a route); adding a **role** never
  does. This is deliberate — a permission no route consults would grant
  nothing while looking like it granted something.
- A custom role can only add permissions, never subtract them: there is no
  per-user deny list, so narrowing what an Employee can do means
  re-permissioning the built-in Employee role, which affects everyone.
- The role/permission cache is per-process, so on a multi-instance deployment
  a permission edit applies immediately only on the instance that served it.
  The current single-instance Render setup is unaffected.
- No `client/src/middleware.ts` — admin/employee route protection is
  client-side only (`RoleGuard`); the backend's `requirePermission(...)` is
  the real authorization boundary.
- Every account verifies its email (`isEmailVerified`) — customer
  registration and staff-account creation both fire the same verification
  link, and a "Verify Email"/"Email Verified" indicator lives on every
  role's profile page. Google Sign-In accounts and seeded/bootstrap accounts
  are exempt (already verified by construction). Being unverified only
  blocks a `customer` from placing orders or posting reviews — staff are
  never locked out of their portal by it.
- No SMS gateway is actually connected — `sendSms` (`server/src/config/sms.ts`)
  is a gateway-ready abstraction gated on `SMS_API_URL`/`SMS_API_KEY`/
  `SMS_SENDER_ID`, but with no provider chosen those are blank and every
  call is a logged no-op. The delivery OTP still reaches the customer via
  email and the order tracking/account page in the meantime.
- The homepage content system (hero slides + homepage sections), navigation
  (header nav links), footer (link columns + social links), and now
  `/about`/`/contact`/`/shipping-policy` (via `/admin/pages`) are all
  admin-editable, but this is not a general CMS/page builder — every
  editable surface is a fixed, known page/section type, and there's still no
  arbitrary page or route creation.
- Google Sign-In is fully implemented but inactive on this machine — no
  `GOOGLE_CLIENT_ID` has been provisioned yet (see Environment variables).
- No SMS gateway is configured anywhere, so there's no phone-OTP
  registration/verification or phone-based login — `phone` is only ever a
  supplementary, duplicate-checked contact field alongside the required
  email login identifier. The delivery-confirmation OTP works around this
  by emailing the code and also displaying it on the order owner's own
  tracking/account page, rather than texting it.
- `/contact`'s phone/email come from the admin-editable `SiteSettings`
  singleton (same one the footer uses); the phone row just doesn't render
  until an admin sets one in `/admin/settings`. Its intro text and address
  line come from the separate `StaticPage` document (`/admin/pages`).

## Notes

- `client/AGENTS.md` is managed by the Next.js CLI itself (rewritten by
  `next dev` when it detects an AI coding agent) — it flags that this Next.js
  major version may differ from an agent's training data. Leave it in place;
  its presence is also what stops Next.js from re-creating a duplicate
  `client/CLAUDE.md`, since this project keeps a single `CLAUDE.md` at the
  repo root.
- Keep this README and `CLAUDE.md` up to date as the codebase changes — see
  the "Documentation maintenance" note at the end of `CLAUDE.md`.

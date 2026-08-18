# Saudi Authentic Product

A full-stack e-commerce platform for premium Saudi & Madinah dates and
heritage products, delivered across Bangladesh — plus internal Admin,
Co-Admin, Super Admin, Order Manager, Employee, and Delivery Agent portals
for running the business. Currency is displayed in BDT and shipping uses
Bangladesh districts — intentional, since the storefront targets
Bangladesh.

```
Saudi-Authentic-Product/
├── backend/     Express 5 + TypeScript + Mongoose REST API
├── frontend/    Next.js 16 (App Router) + React 19 + TypeScript
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

- **Customer storefront** (`frontend/src/app/(site)`): home, shop (filterable
  catalog), product detail (image gallery, variant/quantity selection, a
  wishlist toggle alongside Add to Cart/Buy Now, reviews, delivery info,
  related products), categories, offers (discounted variants), cart,
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
  agent), about, contact, and shipping policy — all three admin-editable
  via the `StaticPage` content system (contact's phone/email still sourced
  separately from the admin-editable `SiteSettings` singleton) — plus a standalone `/checkout`
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
  refresh itself fails — logout-all via token versioning), role-based access
  control across seven roles: `customer`, `employee`, `delivery_agent`,
  `co_admin`, `order_manager`, `admin`, `super_admin`. Registration enforces
  a strong-password policy (8+
  characters, upper + lower case, a digit) with a live strength meter and a
  required confirm-password match, checks both email *and* phone for
  duplicates, and can save an optional first delivery address in the same
  request. A newly-registered customer must verify their email (a timed link
  emailed on signup, `/account/verify-email`, with resend) before placing
  orders or posting reviews — staff and Google Sign-In accounts are exempt.
  A single Sign In / Register / Forgot Password form (`/account`) serves
  every role — there's no separate staff login page. Forgot/reset password
  is one flow that works identically for all seven roles: a time-limited,
  single-use emailed link that invalidates itself (and every other active
  session) once used. Optional "Continue with Google" sign-in/registration
  is wired end-to-end via Google Identity Services (`POST /auth/google`,
  `google-auth-library`) but stays inactive — button hidden, endpoint 503s —
  until a `GOOGLE_CLIENT_ID` is configured (see Environment variables).
- **Admin / Co-Admin / Super Admin / Order Manager portal**
  (`frontend/src/app/admin`, fully built): dashboard (live stats), products
  (deletion is Super-Admin-direct / Co-Admin-request-only — Admin has no
  product-deletion access at all), categories, orders (including assigning
  a delivery agent once an order is ready for dispatch), refunds (Order
  Manager review, then Admin/Super Admin financial approval), coupons
  (percentage/fixed discounts, scheduling window, minimum order amount,
  usage limit — reachable by co_admin too, with large-percentage discounts
  routed through the approval-gate system below), customers, reviews,
  employees, attendance, leave, tasks (categorized by task type),
  performance, salary & payments (admin/super_admin only), inventory (stock
  adjustments + audit log), reports (sales summary), finance (revenue/
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
  Policy body copy, admin/super_admin only), site settings (admin/super_admin
  only). Route access is guarded client-side (`RoleGuard`) and enforced for
  real by the backend's `authorize(...)` on every route; every page whose
  API a co_admin (or, for the super_admin-only pages, an admin too) cannot
  reach shows a friendly "Access restricted" state when navigated to
  directly instead of a broken page shell. `order_manager` reaches the same
  `/admin` shell but its nav is restricted to Dashboard, Orders, Refunds,
  and Audit Logs — a real least-privilege role, not the full admin-tier
  surface.
- **Approval-gate system (Grant-Based Approval Workflow)** — a single
  reusable `PendingAction` queue gates six sensitive action types (coupon
  create/update above a configurable discount size, product deletion by
  co_admin, refund requests by co_admin, refund approvals above a
  configurable amount by admin, and expense confirmation above a
  configurable amount by co_admin): the initiating request returns
  `202 {pendingActionId}` instead of applying immediately, a super_admin
  reviews it at `/admin/approvals` and grants (applies the original payload
  verbatim) or denies it, and both the requester and every super_admin get
  emailed at the relevant step. The four thresholds that decide what gets
  auto-approved vs. gated are stored in a single `ApprovalSettings`
  singleton, editable only by super_admin — never hardcoded.
- **General audit logging** — every sensitive mutation (role/status changes,
  coupon create/update/delete, product deletion, approval-settings edits,
  and every approval-gate grant/deny) writes an append-only `AuditLog`
  entry (actor, role, action, resource, before/after values, optional
  note), visible at `/admin/audit-logs` — scoped to the viewer's own
  actions unless they're admin/super_admin.
- **Employee portal** (`frontend/src/app/employee`, fully built):
  check-in/out + attendance history, tasks (filterable by type — packing,
  product counting, stock checking, warehouse, customer support, data entry,
  product preparation), leave requests, performance history, salary/payment
  history, and a profile page (avatar + address).
- **Delivery portal** (`frontend/src/app/delivery`, fully built, `delivery_agent`
  role only — structurally excluded from `/admin`): a dashboard of assigned-
  order counts, an assigned-orders list with a detail view for marking an
  order picked up / out for delivery, entering the customer's OTP to confirm
  delivery, or recording a failed-delivery reason, plus the same profile
  page as Employee.
- **Order & delivery workflow** — a 14-status pipeline (`pending` →
  `confirmed` → `processing` → `packed` → `ready_for_dispatch` →
  `assigned_to_agent` → `picked_up` → `out_for_delivery` → `otp_verified` →
  `delivered`, plus `delivery_failed`/`cancelled`/`returned`/`refunded`)
  replacing the old flat 5-status enum. Every transition is validated
  against an explicit adjacency table and role-gated (Order Manager/Co-Admin
  drive the pre-dispatch steps and assignment; only the assigned Delivery
  Agent can drive pickup through delivery; refunds are Admin/Super-Admin
  only); every status change records who made it, their role, the previous
  status, and an optional note. Out-for-delivery generates a one-time 6-digit
  code emailed to the customer and also shown on their own order-tracking/
  account page (there's no SMS gateway in this project); the delivery agent
  never sees the code in their own portal and must collect it from the
  customer to confirm delivery.
- **Finance module (Investment, Expense, Refund, Profit/Loss)** — an
  append-only `Investment` ledger; an `Expense` log (12 categories,
  auto-confirmed for admin/super_admin, pending confirmation for co_admin
  above a configurable threshold); a `Refund` workflow (customer/staff
  request on a `returned` order → Order Manager review → Admin/Super Admin
  financial approval, gated by amount for Admin, with an auto-created
  confirmed `Expense` on approval and the order flipped to `refunded`); and
  a finance summary (`/admin/finance`) combining live order revenue (reused
  from the existing sales-report calculation, not duplicated), total
  investment, total confirmed expenses (by category), and net profit/loss —
  all admin/super_admin only.
- **Homepage content management** — admin-editable hero slides (image,
  title, subtitle, CTA, order; all active slides render as an auto-rotating
  carousel) and a fixed set of eight homepage section types (hero, trust
  strip, featured categories, best sellers, product story, customer
  reviews, promo banners, product showcases). The six singleton sections are
  visibility/order-editable only (the trust strip's benefit items —
  icon + label — are individually editable/reorderable/toggleable); promo
  banners and product showcases can be freely created/deleted. A product
  showcase pulls a configurable product grid (by category, best sellers, new
  arrivals, or on-sale) — this is how sections like "Premium Dates" or a
  future Watches/Chocolates showcase get added with no code change.
- **Navigation & footer content management** — the header's top-level nav
  links and the footer's link columns (`/admin/navigation`, `/admin/footer`)
  are freely add/edit/delete/reorder-able, same pattern as hero slides; the
  footer's social icons come from a `socialLinks` list on the same
  `SiteSettings` singleton as the logo/announcement/contact fields
  (`/admin/settings`).
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
- SMTP email notifications (fire-and-forget, never block a request): order
  confirmations, staff welcome, leave status, task assignment, password
  reset, and salary/payment notices (paid or pending-reminder copy).

## Getting started

Requires Node.js 20+ and a MongoDB connection string.

### 1. Backend

```bash
cd backend
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
> `backend/scripts/dev-dns-preload.cjs` (SRV lookups for `mongodb+srv://`
> failing with `ECONNREFUSED` even though normal DNS works), both
> `npm run dev:dns-fix` and `npm start` already load that DNS preload
> automatically — no manual `NODE_OPTIONS` needed. `npm run dev` does not,
> so use `npm run dev:dns-fix` instead of `npm run dev` if you hit that bug
> in watch mode. It's a machine-local workaround (a stale Windows
> network-adapter registry entry, not an app/Atlas/network problem), not a
> real fix — see the comment in that file for details.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env    # NEXT_PUBLIC_API_URL (defaults to http://localhost:5000/api/v1)
npm run dev              # http://localhost:3000
```

Seeded login (see `backend/src/seed/seed.ts` for the full list): a super
admin from your `.env`, plus sample `admin`, `co_admin`, and two `employee`
accounts, all with password `Employee123!`.

## Scripts

Run from inside `backend/` or `frontend/` respectively:

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

`npm start` and `npm run dev:dns-fix` both load `backend/scripts/dev-dns-preload.cjs`
automatically (see the note above) — no manual `NODE_OPTIONS` needed on this
machine.

## Testing

- **Backend**: `npm test` runs Jest (`backend/jest.config.js`, ts-jest) over
  `backend/src/tests/*.test.ts` — 10 unit-style specs covering `ApiError`,
  app bootstrap, the `booleanish` zod helper, `notFoundHandler`, JWT utils,
  `paramStr`, the `authorize` RBAC middleware (including the
  `order_manager`/`delivery_agent` roles), shipping-fee calculation,
  `slugify`, and the `validate` middleware — plus `backend/src/tests/
  integration/*.integration.test.ts`, real end-to-end HTTP specs (auth,
  catalog RBAC/creation, order creation/stock/tracking, the full order status
  pipeline including RBAC/self-scoping/OTP for the delivery workflow,
  task-type categorization, coupon discount-size gating through the
  approval system, the approval-gate/audit-log engine — product-deletion
  RBAC, grant/deny flows, threshold-setting edits — and the full Finance
  module — investment/expense RBAC, expense over-threshold approval-gating,
  a complete refund request→review→approve walk through a real `returned`
  order, and finance-summary math) run with `supertest` against an actual
  in-memory MongoDB via `mongodb-memory-server`. 103 tests passing as of the
  Finance/Approval-gate build. Coverage is still partial, not exhaustive.
- **Frontend**: `npm test` runs Vitest (`vitest.config.mts`, jsdom
  environment) with React Testing Library. Covers pure-logic modules
  (`lib/utils`, `lib/passwordStrength`, `lib/mappers`), one component
  (`PasswordStrengthMeter`), and `CartContext` (add/remove/quantity/
  localStorage persistence, with `lib/api/products` mocked). No
  Playwright/e2e browser testing exists — verify visual/UI changes manually
  in a browser.

## Environment variables

Each app documents its own variables in `backend/.env.example` and
`frontend/.env.example` — copy them to `.env` and fill in real values.
Never commit `.env` files; the root `.gitignore` already excludes them.

**Backend** (`backend/.env.example`, validated by a Zod schema in
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
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN` | refresh token signing secret / TTL |
| `COOKIE_DOMAIN` | domain for the auth cookies |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | image uploads; blank → upload endpoints return 503, rest of the app still works |
| `SMTP_SERVICE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | staff/customer email notifications; blank → sends become a silent logged no-op |
| `GOOGLE_CLIENT_ID` | Google Sign-In OAuth Client ID; blank → `/auth/google` returns 503 and the frontend button stays hidden. Not a secret — see `backend/.env.example` for how to obtain one |
| `SEED_SUPER_ADMIN_NAME` / `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` | bootstrap super-admin account used by `npm run seed` |

**Frontend** (`frontend/.env.example`):

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
- No customer-facing "request a refund" UI — `POST /refunds` already accepts
  a customer-initiated request on their own order, but no page or button in
  the storefront/account portal calls it yet; a refund request can only be
  created from `/admin/refunds` by staff today.
- The approval-gate system covers a fixed, spec-defined list of six action
  types (coupon create/update, product deletion, refund request/approval,
  expense confirmation) — role changes, settings changes, and other
  sensitive actions are audit-logged but do not go through the
  grant/deny `PendingAction` queue.
- No 2FA, session-timeout enforcement, account lockout, or
  impersonation/support-login feature.
- No general notification matrix — only approval-gate-related emails exist
  (a super_admin is notified when a request needs review; the requester is
  notified of the grant/deny outcome). Broader event notifications (new-order
  alerts, low-stock alerts, delivery-failure escalation, etc.) are not
  implemented.
- Cart and wishlist are `localStorage`-only; they don't persist server-side
  or follow a customer across devices/browsers.
- Co-admin's `/admin/salary`, `/admin/finance`, `/admin/investments`,
  `/admin/homepage`, `/admin/navigation`, `/admin/footer`, `/admin/pages`,
  and `/admin/settings` nav links are hidden in the UI, and the layout's
  role guard still admits all admin-tier roles at the route level — but
  each of those pages now checks the role itself and shows a friendly
  "Access restricted" state instead of attempting to load data, so a
  co_admin navigating there directly no longer sees a broken page shell
  with failed API calls. `/admin/approvals` uses the same pattern but is
  restricted to super_admin only (an admin navigating there directly also
  sees the restricted state). `/admin/coupons` and `/admin/expenses` are
  **not** on this restricted list — co_admin has real, working access to
  both now.
- No `frontend/src/middleware.ts` — admin/employee route protection is
  client-side only (`RoleGuard`); the backend is the real authorization
  boundary.
- Storefront registration requires email verification for placing orders
  and posting reviews (`isEmailVerified`); staff and Google Sign-In accounts
  are exempt.
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

- `frontend/AGENTS.md` is managed by the Next.js CLI itself (rewritten by
  `next dev` when it detects an AI coding agent) — it flags that this Next.js
  major version may differ from an agent's training data. Leave it in place;
  its presence is also what stops Next.js from re-creating a duplicate
  `frontend/CLAUDE.md`, since this project keeps a single `CLAUDE.md` at the
  repo root.
- Keep this README and `CLAUDE.md` up to date as the codebase changes — see
  the "Documentation maintenance" note at the end of `CLAUDE.md`.

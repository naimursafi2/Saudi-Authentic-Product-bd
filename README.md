# Saudi Authentic Product

A full-stack e-commerce platform for premium Saudi & Madinah dates and
heritage products, delivered across Bangladesh — plus internal Admin,
Co-Admin, Super Admin, and Employee portals for running the business.
Currency is displayed in BDT and shipping uses Bangladesh districts —
intentional, since the storefront targets Bangladesh.

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
  catalog), product detail, categories, offers (discounted variants), cart,
  wishlist, a sidebar-driven account dashboard (login/register; a persistent
  nav — Dashboard/My Orders/Wishlist/Address/Manage Profile/Logout — next to
  stat cards, recent-orders and wishlist-preview panels, profile photo
  upload via Cloudinary, editable name/phone/password, and a full address
  book with add/edit/delete/set-default), password reset, a public
  order-tracking page (`/track-order` — look up any order by order number +
  checkout email, no login required, auto-prefilled for signed-in
  customers), about, contact (phone/email sourced from the admin-editable
  `SiteSettings` singleton), shipping policy, plus a standalone `/checkout`
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
  control across five roles: `customer`, `employee`, `co_admin`, `admin`,
  `super_admin`. Registration enforces a strong-password policy (8+
  characters, upper + lower case, a digit) with a live strength meter and a
  required confirm-password match, checks both email *and* phone for
  duplicates, and can save an optional first delivery address in the same
  request. A newly-registered customer must verify their email (a timed link
  emailed on signup, `/account/verify-email`, with resend) before placing
  orders or posting reviews — staff and Google Sign-In accounts are exempt.
  A single Sign In / Register / Forgot Password form (`/account`) serves
  every role — there's no separate staff login page. Forgot/reset password
  is one flow that works identically for all five roles: a time-limited,
  single-use emailed link that invalidates itself (and every other active
  session) once used. Optional "Continue with Google" sign-in/registration
  is wired end-to-end via Google Identity Services (`POST /auth/google`,
  `google-auth-library`) but stays inactive — button hidden, endpoint 503s —
  until a `GOOGLE_CLIENT_ID` is configured (see Environment variables).
- **Admin / Co-Admin / Super Admin portal** (`frontend/src/app/admin`,
  fully built): dashboard (live stats), products, categories, orders,
  coupons (percentage/fixed discounts, scheduling window, minimum order
  amount, usage limit — admin/super_admin only), customers, reviews,
  employees, attendance, leave, tasks, performance, salary & payments
  (admin/super_admin only), inventory (stock adjustments + audit log),
  reports (sales summary), homepage content (hero slides + homepage
  sections, admin/super_admin only), site settings (admin/super_admin
  only). Route access is guarded client-side (`RoleGuard`) and enforced for
  real by the backend's `authorize(...)` on every route; the four
  admin/super_admin-only pages (coupons, salary, homepage, settings) show a
  friendly "Access restricted" state for a co_admin who navigates there
  directly instead of a broken page shell.
- **Employee portal** (`frontend/src/app/employee`, fully built):
  check-in/out + attendance history, tasks, leave requests, performance
  history, salary/payment history.
- **Homepage content management** — admin-editable hero slides (image,
  title, subtitle, CTA, order; all active slides render as an auto-rotating
  carousel) and a fixed set of seven homepage section types (hero, featured
  categories, best sellers, product story, customer reviews, promo banners,
  product showcases). The five singleton sections are visibility/order-
  editable only; promo banners and product showcases can be freely
  created/deleted. A product showcase pulls a configurable product grid
  (by category, best sellers, new arrivals, or on-sale) — this is how
  sections like "Premium Dates" or a future Watches/Chocolates showcase get
  added with no code change. This is scoped to the homepage — it is **not**
  a general CMS or page builder; `/about`, `/contact`, and
  `/shipping-policy` remain hardcoded static pages.
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
  `paramStr`, the `authorize` RBAC middleware, shipping-fee calculation,
  `slugify`, and the `validate` middleware — plus `backend/src/tests/
  integration/*.integration.test.ts`, real end-to-end HTTP specs (auth,
  catalog RBAC/creation, order creation/stock/tracking) run with `supertest`
  against an actual in-memory MongoDB via `mongodb-memory-server`. Coverage
  is still partial, not exhaustive.
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
  `Order.isPaid` for them; only a `cod` order marked `delivered` gets marked
  paid. Treat non-COD checkout as UI-only until a real gateway is wired up.
- Cart and wishlist are `localStorage`-only; they don't persist server-side
  or follow a customer across devices/browsers.
- Co-admin's `/admin/salary`, `/admin/coupons`, `/admin/homepage`, and
  `/admin/settings` nav links are hidden in the UI, and the layout's role
  guard still admits all four admin-tier roles at the route level — but each
  of those four pages now checks the role itself and shows a friendly
  "Access restricted" state instead of attempting to load data, so a
  co_admin navigating there directly no longer sees a broken page shell
  with failed API calls.
- No `frontend/src/middleware.ts` — admin/employee route protection is
  client-side only (`RoleGuard`); the backend is the real authorization
  boundary.
- Storefront registration requires email verification for placing orders
  and posting reviews (`isEmailVerified`); staff and Google Sign-In accounts
  are exempt.
- The homepage content system (hero slides + homepage sections) is scoped
  to the homepage only — it is not a general CMS/page builder; other static
  pages aren't admin-editable.
- Google Sign-In is fully implemented but inactive on this machine — no
  `GOOGLE_CLIENT_ID` has been provisioned yet (see Environment variables).
- No SMS gateway is configured anywhere, so there's no phone-OTP
  registration/verification or phone-based login — `phone` is only ever a
  supplementary, duplicate-checked contact field alongside the required
  email login identifier.
- `/contact`'s phone/email now come from the admin-editable `SiteSettings`
  singleton (same one the footer uses) instead of a hardcoded placeholder;
  the phone row just doesn't render until an admin sets one in
  `/admin/settings`.

## Notes

- `frontend/AGENTS.md` is managed by the Next.js CLI itself (rewritten by
  `next dev` when it detects an AI coding agent) — it flags that this Next.js
  major version may differ from an agent's training data. Leave it in place;
  its presence is also what stops Next.js from re-creating a duplicate
  `frontend/CLAUDE.md`, since this project keeps a single `CLAUDE.md` at the
  repo root.
- Keep this README and `CLAUDE.md` up to date as the codebase changes — see
  the "Documentation maintenance" note at the end of `CLAUDE.md`.

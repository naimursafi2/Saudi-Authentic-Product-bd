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
  wishlist, account (login/register + orders/addresses/profile), password
  reset, a public order-tracking page (`/track-order` — look up any order by
  order number + checkout email, no login required), about, contact,
  shipping policy, plus a standalone `/checkout` flow — all backed by the
  live API and Cloudinary imagery. Cart and wishlist are **client-side only**
  (`localStorage`), not synced to the account or across devices — there is
  no server-side cart/wishlist model.
- Secure authentication (JWT via httpOnly access/refresh cookies,
  logout-all via token versioning), role-based access control across five
  roles: `customer`, `employee`, `co_admin`, `admin`, `super_admin`.
- **Admin / Co-Admin / Super Admin portal** (`frontend/src/app/admin`,
  fully built): dashboard (live stats), products, categories, orders,
  customers, reviews, employees, attendance, leave, tasks, performance,
  salary & payments (admin/super_admin only), inventory (stock adjustments +
  audit log), reports (sales summary), homepage content (hero slides +
  homepage sections, admin/super_admin only), site settings (admin/super_admin
  only). Route access is guarded client-side (`RoleGuard`) and enforced for
  real by the backend's `authorize(...)` on every route.
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
| `npm test`             | ✅ Jest (unit tests only, see Testing below) | — (no test runner configured) |
| `npm run seed`         | ✅ bootstrap DB | — |

`npm start` and `npm run dev:dns-fix` both load `backend/scripts/dev-dns-preload.cjs`
automatically (see the note above) — no manual `NODE_OPTIONS` needed on this
machine.

## Testing

- **Backend**: `npm test` runs Jest (`backend/jest.config.js`, ts-jest) over
  `backend/src/tests/*.test.ts` — 10 unit-style specs covering `ApiError`,
  app bootstrap, the `booleanish` zod helper, `notFoundHandler`, JWT utils,
  `paramStr`, the `authorize` RBAC middleware, shipping-fee calculation,
  `slugify`, and the `validate` middleware. There are **no
  integration/e2e tests** against a real or in-memory MongoDB yet.
- **Frontend**: no automated test runner is configured (no Jest/Vitest/
  Playwright). Verify UI changes manually in a browser.

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
| `SEED_SUPER_ADMIN_NAME` / `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` | bootstrap super-admin account used by `npm run seed` |

**Frontend** (`frontend/.env.example`) — just one variable:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | backend API base URL including prefix; defaults to `http://localhost:5000/api/v1` if unset |

## Known limitations

- No backend integration/e2e tests, no frontend automated tests at all —
  see Testing above.
- Cart and wishlist are `localStorage`-only; they don't persist server-side
  or follow a customer across devices/browsers.
- Co-admin's `/admin/salary`, `/admin/homepage`, and `/admin/settings` nav
  links are hidden in the UI, but the route guard itself admits all three
  admin-tier roles — a co_admin navigating there directly gets a page shell
  whose API calls then 403, rather than a redirect. Not a security hole
  (the backend correctly blocks it), but a rough UX edge.
- No `frontend/src/middleware.ts` — admin/employee route protection is
  client-side only (`RoleGuard`); the backend is the real authorization
  boundary.
- The homepage content system (hero slides + homepage sections) is scoped
  to the homepage only — it is not a general CMS/page builder; other static
  pages aren't admin-editable.
- `frontend/src/app/(site)/contact/page.tsx` still has a placeholder phone
  number (`+880 1XXX-XXXXXX`) pending real contact info.

## Notes

- `frontend/AGENTS.md` is managed by the Next.js CLI itself (rewritten by
  `next dev` when it detects an AI coding agent) — it flags that this Next.js
  major version may differ from an agent's training data. Leave it in place;
  its presence is also what stops Next.js from re-creating a duplicate
  `frontend/CLAUDE.md`, since this project keeps a single `CLAUDE.md` at the
  repo root.
- Keep this README and `CLAUDE.md` up to date as the codebase changes — see
  the "Documentation maintenance" note at the end of `CLAUDE.md`.

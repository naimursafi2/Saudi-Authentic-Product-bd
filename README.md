# Saudi Authentic Product

An e-commerce platform for authentic Saudi & Madinah dates, gift boxes and
heritage products, delivered across Bangladesh. Currency is displayed in
**BDT** and shipping uses **Bangladesh districts** — the storefront
specifically targets Bangladesh customers.

Alongside the customer storefront, the platform includes a full internal
back-office: Admin, Co-Admin, Super Admin, Order Manager, Employee, and
Delivery Agent portals, covering catalog management, orders and delivery,
inventory and purchasing, HR, finance, marketing campaigns, and site
content — all backed by a live MongoDB database (no mock data).

## Tech stack

**Backend** (`server/`)
- Express 5 + TypeScript + Mongoose (MongoDB)
- Zod validation, JWT auth (httpOnly cookies), bcrypt password hashing
- Cloudinary (image uploads), Nodemailer (email)
- Jest + `mongodb-memory-server` for testing

**Frontend** (`client/`)
- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 (CSS-variable design tokens, no `tailwind.config.js`)
- Vitest + React Testing Library for testing

The two apps are independent — no shared code — and deploy to different
origins (client on Vercel, server on Render).

## Main features

**Storefront**: catalog browsing with filters/search, product detail pages
with gallery + reviews, cart & wishlist (client-side), coupon codes,
checkout with bKash online payment (server-verified) or cash on delivery,
order tracking (with/without an account), customer account
dashboard (orders, addresses, price-drop/back-in-stock alerts, refunds/
returns), dark/light mode, Google Sign-In, 2FA, email verification.

**Admin/Co-Admin/Super Admin/Order Manager portal**: product & category
management (with a Super-Admin approval gate for new products, stock
changes, and deletions), order lifecycle & delivery-agent assignment,
inventory & purchase-batch/landed-cost tracking, bKash payment transactions
with gateway reconciliation, configurable shipping rates (per-zone charges,
express surcharge, free-shipping threshold, delivery estimates), coupons,
customer
messaging campaigns (email/SMS-ready/website notifications), reviews
moderation, HR (leave, tasks, performance, salary, NID records), finance
(investments, expenses, refunds, profit/loss, gross profit), a role &
permission management system with custom roles, a Grant-Based Approval
Workflow for high-risk actions, a centralized internal upload registry with a
delete-approval flow and 15-day recycle bin, audit logging, homepage/navigation/footer/
static-page content management, site settings, and sales/delivery
analytics with CSV/PDF export.

**Employee portal**: tasks, leave requests, performance reviews, salary
history, read-only stock lookup, expense submission, profile.

**Delivery portal**: assigned-order queue, pickup/dispatch actions, OTP-based
delivery confirmation, delivery-failure reporting.

Authorization throughout is **permission-based** — every role's access is a
list of granular permissions (backed by real API-level checks), not a
hardcoded role check, so new roles can be created from the admin panel with
no code change.

## Project structure

```
server/    Express 5 + TypeScript + Mongoose REST API
  src/
    routes/        Express routers (auth wiring)
    controllers/    Thin request handlers
    services/       Business logic + Mongoose queries
    validators/     Zod schemas
    models/         Mongoose schemas
    middlewares/    auth, rbac, validation, uploads, rate limiting
    tests/          Jest unit + integration specs

client/    Next.js 16 (App Router) + React 19 + Tailwind v4
  src/
    app/            (site)/ storefront, admin/, employee/, delivery/, checkout/
    components/      ui/ primitives + per-domain feature components
    context/          AuthContext, CartContext, WishlistContext, ThemeContext, ...
    lib/api/          One file per backend resource
    lib/mappers.ts    Raw API shapes -> storefront view-models
    types/            Shared TypeScript types mirroring backend JSON
```

See `CLAUDE.md` for the detailed backend route table, architectural
patterns, and development conventions.

## Installation & setup

Prerequisites: Node.js, a MongoDB connection string (Atlas or local),
Cloudinary account (image uploads), and an SMTP provider (email) — the
last two are optional and degrade gracefully if unset.

```bash
# Backend
cd server
npm install
cp .env.example .env   # fill in MONGODB_URI, JWT secrets, etc.
npm run seed            # creates a super admin + sample data
npm run dev              # http://localhost:5000, API at /api/v1

# Frontend
cd client
npm install
cp .env.example .env
npm run dev               # http://localhost:3000
```

## Environment configuration

**`server/.env`** (see `server/.env.example` for the full list):
`NODE_ENV`, `PORT`, `API_PREFIX`, `CLIENT_ORIGIN` (CORS), `MONGODB_URI`,
`JWT_ACCESS_SECRET`/`JWT_ACCESS_EXPIRES_IN`,
`JWT_REFRESH_SECRET`/`JWT_REFRESH_EXPIRES_IN`, `COOKIE_DOMAIN`,
`CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`,
`SMTP_SERVICE`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM`, `GOOGLE_CLIENT_ID`,
`BKASH_BASE_URL`/`BKASH_USERNAME`/`BKASH_PASSWORD`/`BKASH_APP_KEY`/
`BKASH_APP_SECRET`,
`SEED_SUPER_ADMIN_NAME`/`SEED_SUPER_ADMIN_EMAIL`/`SEED_SUPER_ADMIN_PASSWORD`.
Validated via Zod on startup — the app fails fast if a required var is
missing. Cloudinary/SMTP/Google/SMS/bKash vars are optional; the affected
feature degrades gracefully (a clear 503, or a silent no-op) rather than
crashing. The bKash credentials are secrets — they stay server-side and are
never sent to the browser or logged.

**`client/.env`**: `NEXT_PUBLIC_API_URL` (defaults to
`http://localhost:5000/api/v1`), `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (optional —
hides the "Continue with Google" button when unset; must match the
backend's `GOOGLE_CLIENT_ID`).

## Available scripts

| Command | Backend (`server/`) | Frontend (`client/`) |
| --- | --- | --- |
| `npm run dev` | Start dev server (tsx watch) | Start Next.js dev server |
| `npm run dev:dns-fix` | Dev server + local DNS workaround (see below) | — |
| `npm run build` | Compile TypeScript to `dist/` | Production build |
| `npm start` | Run compiled server | Run production build |
| `npm run seed` | Seed super admin + sample data | — |
| `npm run typecheck` | `tsc --noEmit` | `tsc --noEmit` |
| `npm run lint` | ESLint | ESLint |
| `npm test` | Jest (unit + integration) | Vitest (unit + component) |

## API overview

REST API mounted under `/api/v1` (configurable via `API_PREFIX`). Resource
groups: `/auth`, `/users`, `/categories`, `/products`, `/orders`,
`/reviews`, `/leaves`, `/tasks`, `/performance-reviews`,
`/salary-payments`, `/inventory`, `/purchases`, `/reports`, `/finance`,
`/coupons`, `/hero-slides`, `/homepage-sections`, `/nav-links`,
`/footer-columns`, `/static-pages`, `/site-settings`, `/audit-logs`,
`/pending-actions`, `/approval-settings`, `/investments`, `/expenses`,
`/refunds`, `/returns`, `/roles`, `/campaigns`, `/notifications`,
`/product-alerts`, `/payments`, `/shipping-settings`, `/internal-assets`. Auth
is JWT via httpOnly cookies (or a bearer token for
staff impersonation); most write routes require a specific permission. See
`CLAUDE.md`'s route table for per-route access rules.

## Deployment

- **Client** deploys to **Vercel** as a Next.js app (`client/vercel.json`
  declares `"framework": "nextjs"` only — no custom rewrites).
- **Server** deploys to **Render** as a standard Node service (`npm run
  build && npm start`).
- The two apps sit on different origins — see `client/src/proxy.ts` for
  what that implies for cookies/CORS.

### Local DNS workaround (Windows dev only)

If `mongodb+srv://` lookups fail locally with `querySrv ECONNREFUSED`, use
`npm run dev:dns-fix` instead of `npm run dev` — see `server/scripts/`
and `CLAUDE.md` for details. This does not affect `typecheck`/`lint`/`test`
or any deployed environment.

## Known limitations

- bKash payment is implemented end-to-end but stays hidden at checkout until
  real `BKASH_*` credentials are configured. `nagad` is selectable but has no
  gateway behind it and is never actually charged.
- Abandoned bKash payments have no automatic expiry — an unpaid order holds
  its stock and coupon use until someone cancels it.
- No SMS gateway connected — SMS-dependent features (delivery OTP, campaign
  SMS) degrade to email/other channels.
- No PDF-generation library anywhere — every "print"/"export as PDF" action
  (invoices, Expenses, Sales Report) uses the browser's own print-to-PDF;
  CSV export is hand-rolled.
- No e2e/browser test suite — UI changes need manual verification.
- Test coverage is solid but not exhaustive on either side.

See `CLAUDE.md` for the complete, up-to-date list of architectural and
functional limitations.

## Documentation

`README.md` (this file) covers public project documentation. `CLAUDE.md`
covers architecture, conventions, and AI-assisted development rules. Both
are kept accurate as the codebase changes — see the "Documentation policy"
note at the top of `CLAUDE.md` for how updates to these two files are
scoped.

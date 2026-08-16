# Saudi Authentic Product

An e-commerce platform (Saudi/Madinah dates, gift boxes, and future categories)
with a customer storefront plus internal Admin / Co-Admin / Super Admin /
Employee portals. Currency is displayed in **BDT** and shipping uses
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
| `/auth` | register/login/`google` (Continue with Google)/refresh/logout/logout-all, `GET /me`, change-password, forgot/reset-password. Login/register/google/refresh/forgot/reset are rate-limited via `authLimiter`. | mostly public; `/logout-all`, `/me`, `/change-password` require auth; `/google` 503s until `GOOGLE_CLIENT_ID` is configured |
| `/users` | customer's own profile (`PATCH /me` — name/phone), avatar (`PATCH`/`DELETE /me/avatar`, image upload via Cloudinary), address CRUD (`POST`/`PATCH`/`DELETE /me/addresses[/:addressId]`); staff creation/listing/role/status/staff-meta updates | create/role/status/staff-meta: `admin`,`super_admin`; list/get: + `co_admin`; all `/me/...` routes just require `authenticate` — scoped to the calling user via `req.user.id`, no role check needed |
| `/categories` | public list/get by slug; create/update (image upload)/delete | create/update: `admin`,`super_admin`,`co_admin`; delete: `admin`,`super_admin` |
| `/products` | public list/get by slug; admin get-by-id; create/update (up to 6 images + JSON-encoded `categories`/`variants`/`highlights`); delete | create/update/admin-get: `admin`,`super_admin`,`co_admin`; delete: `admin`,`super_admin` |
| `/orders` | customer creates/lists own (`/mine`); public `GET /track` (order number + email); staff lists all + updates status; `GET /:id` ownership-checked in controller | list-all/status-update: `admin`,`super_admin`,`co_admin`(+`employee` for list); `/track` is public (mounted before the router's `authenticate`) |
| `/reviews` | public: recent reviews, reviews by product; customer creates one review per product; staff lists all/deletes | list-all/delete: `admin`,`super_admin`,`co_admin` |
| `/attendance` | self check-in/check-out/`mine`; staff: today summary, list all, update record | admin ops: `admin`,`super_admin`,`co_admin` |
| `/leaves` | employee creates/lists own/cancels; staff lists all + approves/rejects | review/list-all: `admin`,`super_admin`,`co_admin` |
| `/tasks` | employee lists own (`/mine`) + updates own status; staff creates/lists/updates/deletes | create/list/update: `admin`,`super_admin`,`co_admin`; delete: `admin`,`super_admin` |
| `/performance-reviews` | employee lists own reviews; staff creates/lists | create/list: `admin`,`super_admin`,`co_admin` |
| `/salary-payments` | employee lists own payment history; admin creates payment/lists all/updates status/sends notify email | `admin`,`super_admin` **only** — co_admin is deliberately excluded |
| `/inventory` | low-stock list, logs, manual stock adjustment | `admin`,`super_admin`,`co_admin` for everything (router-level) |
| `/reports` | any staff: `/employee-dashboard`; admin/co-admin: `/dashboard`, `/sales` | dashboard/sales: `admin`,`super_admin`,`co_admin` |
| `/hero-slides` | public list; create/update (image)/delete of homepage hero carousel slides | `admin`,`super_admin` only |
| `/homepage-sections` | public list; create (promo banners & product showcases only)/update/delete of homepage content sections | `admin`,`super_admin` only |
| `/site-settings` | public `GET /` (singleton); `PATCH /` (logo upload) for site name/announcement/contact/footer | `admin`,`super_admin` only |

**Public order tracking** (`GET /orders/track?orderNumber=...&email=...`,
`order.service.ts#trackOrder`): unauthenticated customers look up an order by
its human-readable `orderNumber` (e.g. `SAP-20260816-1234`) plus the email
used at checkout — both must match or the endpoint 404s with a generic "no
order found" message, so a guessed/leaked order number alone can't be used
to pull up someone else's order. Powers the storefront's `/track-order` page
(`frontend/src/app/(site)/track-order/page.tsx`); it is the only unauthenticated
route under `/orders` (mounted before the router's `router.use(authenticate)`).

#### Models (`src/models`)

`User` (bcrypt password, `role` enum, `tokenVersion` for logout-all/invalidation, embedded `addresses[]`, optional `staffMeta`), `Category`, `Product` (embedded `variants[]` with per-variant price/stock/SKU, auto-derived `minPriceBDT`, text-indexed), `Order` (embedded item/shipping snapshots, `statusHistory[]`), `Review` (one per customer per product), `Attendance`, `LeaveRequest`, `Task`, `PerformanceReview`, `SalaryPayment`, `InventoryLog` (audit trail for stock changes — order placed/cancelled/manual adjustment), `HeroSlide`, `HomepageSection` (see "Homepage content management" below), `SiteSettings` (singleton).

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
- **Homepage sections** (`HomepageSection`): a **fixed enum** of seven
  types — `hero`, `featuredCategories`, `bestSellers`, `productStory`,
  `customerReviews`, `promoBanner`, `productShowcase`. The first five are
  singleton documents (unique index on `type`), lazily seeded from
  `HOMEPAGE_SECTION_DEFAULTS`, editable (title/subtitle/description/image/
  visibility/sort order) but **not creatable or deletable**. `promoBanner`
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

There is no arbitrary page/route creation, no rich-text/WYSIWYG block editor,
and no way to add admin-editable content to any page other than the
homepage — `/about`, `/contact`, and `/shipping-policy` are hardcoded static
JSX. `SiteSettings` (site name, logo, announcement bar text, contact
email/phone, footer tagline — `/admin/settings`) is a separate, unrelated
singleton, not part of the homepage-section system. If asked for "the CMS,"
this is it — don't imply more editability exists than this.

#### Middlewares (`src/middlewares`)

- `authenticate` — JWT from `accessToken` cookie or `Authorization: Bearer`; checks `isActive` + `tokenVersion`. `attachUserIfPresent` — same but non-failing (optional auth).
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
`utils/jwt.ts`). Roles: `customer | employee | co_admin | admin | super_admin`
(`constants/roles.ts`). No DB permission matrix — every route hand-lists
allowed roles via `authorize(...)`, matching existing convention. Convention:
co_admin can run day-to-day HR (attendance/leave/tasks/performance) but never
touches salary, staff role/status, or deletes — those are admin/super_admin only.

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
contact field alongside the required email login identifier.

**Forgot / reset password** (`auth.service.ts#forgotPassword`/`resetPassword`,
`utils/jwt.ts#signPasswordResetToken`) works identically for **every role**
(customer, employee, co_admin, admin, super_admin) — it's a single flow keyed
by email against the shared `User` model, not a per-role system. `POST
/auth/forgot-password` always responds success without revealing whether the
email exists, and (best-effort, fire-and-forget) emails a link
`{CLIENT_ORIGIN}/account/reset-password?token=...` carrying a JWT signed with
a `purpose: "password_reset"` claim and a 30-minute expiry. `POST
/auth/reset-password` requires `newPassword`+`confirmPassword` (same
strength/match rules as registration) and verifies the token's `purpose` and
`tokenVersion`; on success it bumps the user's `tokenVersion`, which both
sets the new password **and** invalidates the token (and every other active
session) so it cannot be replayed. Same "Forgot password?" link and reset
page serve all five roles — there's no separate admin/employee login screen
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
`shipping`, `slugify`, `validateMiddleware`). Jest + ts-jest
(`backend/jest.config.js`, uses `tsconfig.jest.json` since the main
`tsconfig.json` excludes `src/tests/**/*` from the build). No
integration/e2e tests against a real or in-memory MongoDB exist yet — that's
a real coverage gap, not an oversight to "fix" silently; flag it if asked
about test coverage.

### Frontend (`frontend/src`)

```
app/(site)/...      Customer storefront (App Router route group)
app/checkout/...     Checkout flow — a TOP-LEVEL route (NOT inside (site)),
                      with its own layout.tsx, so it does not share the
                      storefront header/footer chrome
app/admin/...        Admin / Co-Admin / Super Admin portal (role-guarded)
app/employee/...     Employee portal (role-guarded)
components/ui/       Shared primitives: Button, ProductCard, SectionHeading, ProductVisual, etc.
components/<domain>/ Feature components (checkout/, product/, shop/, admin/, employee/, home/, account/)
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
backend exists for them. Staff roles see a redirect card to `/admin` or
`/employee` instead of the dashboard; when signed out, renders `AuthForms` —
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

Guarded as a group by `RoleGuard allowed={["co_admin","admin","super_admin"]}`
in `app/admin/layout.tsx`. Every page below does real CRUD against the live
API (loading/empty/error states via `EmptyState`/`TableSkeleton`/`ErrorState`,
modal forms via `Modal.tsx`, `PageHeader`, `StatusBadge`,
`AdminPagination`) — none are placeholders:

`/admin` (dashboard: revenue/orders/customers/active-products/low-stock/
pending-leaves stat cards, today's attendance, top products), `/admin/products`,
`/admin/categories`, `/admin/orders`, `/admin/customers`, `/admin/reviews`,
`/admin/employees`, `/admin/attendance`, `/admin/leave`, `/admin/tasks`,
`/admin/performance`, `/admin/salary` (nav-hidden from co_admin),
`/admin/inventory`, `/admin/reports`, `/admin/homepage` (hero slides +
homepage sections — nav-hidden from co_admin), `/admin/settings` (site
settings — nav-hidden from co_admin).

Co-admin nav restriction (`AdminNav.tsx`) is **UI-level only** — the layout's
`RoleGuard` accepts the whole `["co_admin","admin","super_admin"]` union, so
a co_admin who navigates directly to `/admin/salary` (or `/homepage`,
`/settings`) still renders the page shell; the backend then 403s the actual
API calls (those routes require `admin`/`super_admin`). This matches the
backend's real authorization boundary but means the co_admin sees a broken
page rather than being redirected — a known UX gap, not a security hole.

#### Employee portal (`app/employee`) — fully built, not stubbed

Guarded by `RoleGuard allowed={["employee"]}` in `app/employee/layout.tsx`:
`/employee` (dashboard), `/employee/attendance` (check-in/out + history),
`/employee/tasks`, `/employee/leave`, `/employee/performance`,
`/employee/salary`.

**Data flow convention**: never fetch raw API shapes directly in a component.
Call the relevant `lib/api/*.ts` function, then map through `lib/mappers.ts`
(`toProduct`, `toCategory`, `toCustomerReview`) before handing data to a
component. This keeps components decoupled from Mongo's `_id`/populated-ref
shapes.

**Auth**: `AuthContext` hydrates from `GET /auth/me` on mount (cookie-based,
`credentials: "include"` on every request — set in `lib/api/client.ts`).
`status` is `"loading" | "authenticated" | "unauthenticated"`. Admin/Employee
routes are guarded **client-side only** via `components/admin/RoleGuard.tsx`
(checks `useAuth()`, shows a loading placeholder, then redirects to
`/account` if unauthenticated or the role doesn't match) — **there is no
`frontend/src/middleware.ts`**; the guard is UX-only (avoids a flash of admin
UI), and the API enforces the real authorization server-side.

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

**Testing**: no automated test runner is configured for the frontend
(`package.json` has `dev`/`build`/`start`/`lint`/`typecheck` only, no
`test` script, no Jest/Vitest/Playwright config). Verification is manual/
browser-based — see "For UI or frontend changes" in the Doing Tasks
guidance at the top of the harness system prompt.

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

- **No backend integration/e2e tests** — only unit-style Jest specs exist
  (see Testing above); nothing exercises a real request against a real or
  in-memory MongoDB.
- **No automated frontend tests at all** — no test runner is configured.
  UI changes must be verified by hand in a browser.
- **Cart/wishlist don't persist server-side or cross-device** — they're
  `localStorage`-only (see "Cart & wishlist are client-side only" above).
- **Co-admin route gating is UI-only for `/admin/salary`, `/admin/homepage`,
  `/admin/settings`** — the layout guard admits all three admin-tier roles;
  a co_admin who navigates there directly gets a page shell whose API calls
  then 403, rather than a redirect.
- **No `frontend/src/middleware.ts`** — route protection is entirely
  client-side (`RoleGuard`) plus real backend authorization; there's no
  server-side redirect before the page ships to the browser.
- **No silent access-token refresh on the frontend** — `JWT_ACCESS_EXPIRES_IN`
  defaults to 15 minutes, and `lib/api/client.ts` has no interceptor that
  calls `POST /auth/refresh` on a 401; once the access-token cookie expires
  mid-session, the next mutating request (e.g. placing an order) fails with
  401 and the user is silently signed out (`AuthContext`'s next `GET
  /auth/me` also 401s), even though the 30-day `refreshToken` cookie is
  still valid. Confirmed by hitting this live: `POST /orders` 401'd after a
  session sat open past the access-token TTL, requiring a fresh sign-in.
  Not something to silently "fix" as a drive-by — it changes the auth
  client's architecture — but worth knowing if a customer reports being
  logged out mid-checkout.
- **Google Sign-In is wired end-to-end but inactive** — no `GOOGLE_CLIENT_ID`
  has been provisioned on this machine, so `POST /auth/google` 503s and the
  frontend's "Continue with Google" button doesn't render. See "Google
  Sign-In" above for the exact setup steps; nothing else needs to change once
  a Client ID is added to both `.env` files.
- **No SMS/phone-based registration verification** — registration collects
  an optional `phone` field (validated + checked for duplicates) but there is
  no SMS gateway configured anywhere in this project, so there is no
  phone-OTP signup flow or phone-based login; email remains the only login
  identifier.
- Static content pages (`/about`, `/contact`, `/shipping-policy`) are
  hardcoded JSX, not admin-editable — only the homepage has editable
  content (see "Homepage content management").
- `frontend/src/app/(site)/contact/page.tsx` currently has a placeholder
  phone number literal (`+880 1XXX-XXXXXX`) — real contact info still
  needs to be filled in before this is launch-ready copy.

## Documentation maintenance

Keep this file and the root `README.md` accurate as the codebase changes —
when you add/remove a route, model, page, portal feature, script, or env
var, update the relevant section here (and the corresponding summary in
`README.md`) in the same change. Only document what you've verified exists
in the code; don't carry forward stale claims or add speculative/planned
features.

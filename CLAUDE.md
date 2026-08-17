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
| `/auth` | register/login/`google` (Continue with Google)/refresh/logout/logout-all, `GET /me`, change-password, forgot/reset-password, verify-email/resend-verification. Login/register/google/refresh/forgot/reset/verify-email/resend-verification are rate-limited via `authLimiter`. | mostly public; `/logout-all`, `/me`, `/change-password` require auth; `/google` 503s until `GOOGLE_CLIENT_ID` is configured |
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
| `/coupons` | `POST /validate` (authenticated customer, preview a discount); admin CRUD (`GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`) | `admin`,`super_admin` only for CRUD — deliberately excludes `co_admin`, matching the `/site-settings`/`/homepage-sections`/`/salary-payments` restriction pattern; `/validate` just requires `authenticate` |
| `/nav-links` | public list (sorted, visible-only by default); admin create/update/delete of the storefront header's top-level nav links | create/update/delete: `admin`,`super_admin` only |
| `/footer-columns` | public list (sorted, visible-only by default); admin create/update/delete of the storefront footer's link columns (each with an embedded, wholesale-replaced `links[]`) | create/update/delete: `admin`,`super_admin` only |
| `/static-pages` | public list + `GET /:type` (lazily-seeded singleton per fixed page type); admin `PATCH /:type` (hero image upload) | update: `admin`,`super_admin` only |

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
CRUD (list/create/edit/delete) restricted the same way as
salary/homepage/settings — a `co_admin` who navigates there directly sees
the same friendly "Access restricted" state (see "Co-admin admin-portal UX"
below), not a broken page, since the backend route already 403s them.

**Public order tracking** (`GET /orders/track?orderNumber=...&email=...`,
`order.service.ts#trackOrder`): unauthenticated customers look up an order by
its human-readable `orderNumber` (e.g. `SAP-20260816-1234`) plus the email
used at checkout — both must match or the endpoint 404s with a generic "no
order found" message, so a guessed/leaked order number alone can't be used
to pull up someone else's order. Powers the storefront's `/track-order` page
(`frontend/src/app/(site)/track-order/page.tsx`); it is the only unauthenticated
route under `/orders` (mounted before the router's `router.use(authenticate)`).

#### Models (`src/models`)

`User` (bcrypt password, `role` enum, `tokenVersion` for logout-all/invalidation, embedded `addresses[]`, optional `staffMeta`), `Category`, `Product` (embedded `variants[]` with per-variant price/stock/SKU, auto-derived `minPriceBDT`, text-indexed), `Order` (embedded item/shipping snapshots, `statusHistory[]`, optional `couponCode`/`discountBDT`), `Coupon` (code, discount type/value, order window, optional usage limit — see "Coupons" below), `Review` (one per customer per product), `Attendance`, `LeaveRequest`, `Task`, `PerformanceReview`, `SalaryPayment`, `InventoryLog` (audit trail for stock changes — order placed/cancelled/manual adjustment), `HeroSlide`, `HomepageSection` (see "Homepage content management" below), `SiteSettings` (singleton — site name/logo/announcement/contact/footer tagline, plus an embedded `socialLinks[]` of `{platform, url}`, `platform` one of a fixed enum), `NavLink`, `FooterColumn` (see "Navigation & footer content management" below), `StaticPage` (see "Static page content management" below).

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
`shipping`, `slugify`, `validateMiddleware`), plus `backend/src/tests/
integration/*.integration.test.ts` — real HTTP-through-Mongoose integration
specs (`auth`, `catalog`, `order`) run against an actual in-memory MongoDB
via `mongodb-memory-server` (`tests/integration/setup.ts` starts/stops it
and wipes collections between tests; `tests/integration/helpers.ts` creates
a DB-backed user and signs a bearer token for it, bypassing `authLimiter` so
RBAC-focused tests aren't rate-limited). They exercise `createApp()` with
`supertest` end-to-end: register/login/`me`/logout, category+product RBAC
and creation, and order creation/stock-decrement/tracking/ownership. Both
suites run together via `npm test` (Jest + ts-jest, `backend/jest.config.js`,
`tsconfig.jest.json` since the main `tsconfig.json` excludes `src/tests/**/*`
from the build).

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
`/admin/categories`, `/admin/orders`, `/admin/coupons` (nav-hidden from
co_admin), `/admin/customers`, `/admin/reviews`,
`/admin/employees`, `/admin/attendance`, `/admin/leave`, `/admin/tasks`,
`/admin/performance`, `/admin/salary` (nav-hidden from co_admin),
`/admin/inventory`, `/admin/reports`, `/admin/homepage` (hero slides +
homepage sections — nav-hidden from co_admin), `/admin/navigation` (header
nav links — nav-hidden from co_admin), `/admin/footer` (footer link columns
— nav-hidden from co_admin), `/admin/pages` (About/Contact/Shipping Policy
body copy — nav-hidden from co_admin), `/admin/settings` (site settings,
including social links — nav-hidden from co_admin).

**Co-admin admin-portal UX**: the layout's `RoleGuard` (`app/admin/layout.tsx`)
accepts the whole `["co_admin","admin","super_admin"]` union — it's a role
gate, not a per-page one — so a co_admin who navigates directly to
`/admin/salary`, `/admin/coupons`, `/admin/homepage`, `/admin/navigation`,
`/admin/footer`, `/admin/pages`, or `/admin/settings` still reaches the page shell
(`AdminNav.tsx` only hides the link, it doesn't block the route). Each of
those pages handles this itself with a
page-level check — `const isRestricted = user?.role === "co_admin"` — that
renders a friendly `EmptyState` ("Access restricted... available to Admin
and Super Admin only") instead of attempting to load data, rather than
letting the page render its normal shell and have every API call inside it
403. This is UX polish on top of the backend's real authorization boundary
(those routes already reject co_admin server-side) — not a substitute for
it, and not a security fix, since the API was never reachable by co_admin
in the first place.

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
  plus a small set of integration tests (auth, catalog, order) against an
  in-memory MongoDB, and the frontend has Vitest/RTL coverage for a handful
  of pure-logic modules, one component, and `CartContext` (see Testing in
  both Architecture sections above). Most routes/pages/components still have
  no automated test; UI/visual changes still need manual browser
  verification, and no Playwright/e2e browser testing exists.
- **No payment gateway integration** — `paymentMethod` (`cod`/`bkash`/
  `nagad`) is stored on the order but there is no `config/payment.ts`, no
  webhook/callback route, and no signature verification; `Order.isPaid` only
  ever flips to `true` for a `cod` order marked `delivered`
  (`order.service.ts#updateOrderStatus`) — a `bkash`/`nagad` order is never
  actually charged or marked paid by anything in this codebase, and the
  frontend checkout never redirects to a gateway. Treat "select bKash/Nagad
  at checkout" as UI-only until a real gateway (e.g. bKash/SSLCommerz) is
  integrated.
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
- **No SMS/phone-based registration verification** — registration collects
  an optional `phone` field (validated + checked for duplicates) but there is
  no SMS gateway configured anywhere in this project, so there is no
  phone-OTP signup flow or phone-based login; email remains the only login
  identifier.
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

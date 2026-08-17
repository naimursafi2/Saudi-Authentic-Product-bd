# Saudi Authentic Product — Step-by-Step Fix & Implementation Plan

**Audience:** This document is written to be handed directly to a coding agent (e.g. Codex) as an execution plan. Each phase is ordered and has a dependency on the previous phase being fully verified. Do not skip ahead or reorder phases — later phases assume earlier ones are done and green.

**Repo layout:** monorepo at `Saudi-Authentic-Product/` with two independent projects: `frontend/` (Next.js 16 + React 19 + TypeScript) and `backend/` (Express 5 + TypeScript + MongoDB/Mongoose).

**Golden rule for every phase:** after making changes, run the verification commands listed for that phase and fix every error/warning before moving to the next phase. Never leave the repo in a state where typecheck/build/lint is red.

---

## PHASE 1 — Backend: Audit, Fix, Stabilize (fix only, no new features yet)

Goal: confirm the existing backend code is fully correct and consistent. Do not add any new routes/models/features in this phase — only fix bugs and inconsistencies in what already exists.

### Step 1.1 — Baseline verification
```bash
cd backend
npm install
npm run typecheck
npm run build
npm run lint
npm test
```
Record the output. If everything passes, note that as the baseline. If anything fails, fix it before continuing — do not proceed to Phase 2 with a red backend.

### Step 1.2 — Manual consistency review
Go through every file under `backend/src/routes/` and cross-check against `backend/src/controllers/` and `backend/src/middlewares/`:
- Every route that mutates data (POST/PATCH/DELETE) must have `authenticate` + `authorize(...)` (or `authorizeSelfOrRoles`) applied, unless it is intentionally public (e.g. category/product GET routes). List any route missing authorization and fix it.
- Every route with a request body must have a `validate({ body: ... })` zod schema applied. List any route missing validation and fix it.
- Confirm every controller uses `catchAsync` and `sendSuccess`/`ApiError` consistently (no raw `try/catch` + manual `res.json` patterns mixed in).

### Step 1.3 — Confirm environment & DB config
- Confirm `backend/.env.example` documents every variable referenced in `backend/src/config/env.ts`.
- Confirm `backend/src/config/db.ts` and `backend/src/config/cloudinary.ts` fail gracefully (not silently) when misconfigured.

### Step 1.4 — Re-run verification
Re-run the Step 1.1 command block. All four must pass before moving to Phase 2.

---

## PHASE 2 — Frontend: Audit, Fix, Stabilize (fix only, no new features yet)

### Step 2.1 — Add the missing `typecheck` script
`frontend/package.json` currently only has `dev`, `build`, `start`, `lint` — there is no `typecheck` script. Add one:
```json
"scripts": {
  "typecheck": "tsc --noEmit"
}
```

### Step 2.2 — Baseline verification
```bash
cd frontend
npm install
npm run typecheck
npm run lint
npm run build
```
Fix every error/warning before continuing.

### Step 2.3 — Manual review
- Confirm every component under `src/components/` and `src/app/` has consistent prop typing (no implicit `any`).
- Confirm there are no duplicate/unused components (search for files that are never imported anywhere).
- Do NOT remove `src/data/*.ts` or its imports yet — they are still in active use and removing them now will break the app. That cleanup happens in Phase 5, only after Phase 4 replaces every usage.

### Step 2.4 — Re-run verification
Re-run Step 2.2. Must be fully green before moving to Phase 3.

---

## PHASE 3 — Build the Integration Layer (new code, purely additive)

Goal: build the plumbing that lets the frontend talk to the backend, without touching any existing page yet.

### Step 3.1 — Environment variable
Create `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```
Also add `NEXT_PUBLIC_API_URL` documentation to a new `frontend/.env.example`.

### Step 3.2 — API client
Create `frontend/src/lib/api/client.ts`: a `fetch` wrapper that:
- Prefixes every request with `process.env.NEXT_PUBLIC_API_URL`.
- Always sends `credentials: "include"` (the backend uses httpOnly cookies for auth).
- Parses the backend's standard response envelope `{ success, message, data, pagination? }`.
- Throws a typed error (including HTTP status and backend `message`) on `success: false` or non-2xx.
- Exports typed helpers: `apiGet`, `apiPost`, `apiPatch`, `apiDelete`.

### Step 3.3 — Per-resource API modules
Create one file per backend resource under `frontend/src/lib/api/`:
- `auth.ts` — `register`, `login`, `logout`, `logoutAll`, `getMe`, `changePassword` (map to `/auth/*`)
- `products.ts` — `listProducts(query)`, `getProductBySlug(slug)` (map to `/products`, `/products/:slug`)
- `categories.ts` — `listCategories()`, `getCategoryBySlug(slug)` (map to `/categories`, `/categories/:slug`)
- `orders.ts` — `createOrder(payload)`, `listMyOrders()`, `getOrder(id)` (map to `/orders`, `/orders/mine`, `/orders/:id`)
- `reviews.ts` — `listReviews(productId)`, `createReview(productId, payload)` (map to `/reviews/product/:productId`)
- `users.ts` — `addAddress(payload)`, `removeAddress(addressId)` (map to `/users/me/addresses`)

Each function should be a thin typed wrapper around the Step 3.2 client — no business logic here.

### Step 3.4 — Type mappers
Create `frontend/src/lib/api/mappers.ts`. The backend's `Product`/`Category` shapes (see `backend/src/models/Product.model.ts`, `backend/src/models/Category.model.ts`) differ from the frontend's existing `frontend/src/types/product.ts` shape (which was designed around the mock data in `src/data/products.ts`). Write mapper functions (`mapBackendProduct`, `mapBackendCategory`, etc.) that convert backend API responses into the shape the existing UI components already expect, so Phase 4 requires minimal changes to component internals.

### Step 3.5 — AuthContext
Create `frontend/src/context/AuthContext.tsx`, modeled after the existing `CartContext.tsx`/`WishlistContext.tsx` pattern:
- On mount, call `getMe()` to hydrate the current session (handle the "not logged in" case gracefully — this is not an error state).
- Expose `user`, `isLoading`, `login()`, `register()`, `logout()`.
- Wrap the app with this provider in `frontend/src/app/layout.tsx` alongside the existing Cart/Wishlist providers.

### Step 3.6 — Verify
```bash
cd frontend
npm run typecheck
npm run lint
```
This phase adds new files only — nothing existing should break. Fix anything that does before Phase 4.

---

## PHASE 4 — Wire Each Page to Real Data (one at a time, verify after each)

**Do this file by file, not all at once.** After each numbered step, run `npm run dev`, manually load the affected page in the browser with the backend running (`cd backend && npm run dev`, seeded via `npm run seed`), and confirm it renders real data before moving to the next step.

### Step 4.1 — Homepage
Update `frontend/src/components/home/FeaturedCategories.tsx`, `BestSellers.tsx`, `CustomerReviews.tsx` to fetch via the Phase 3 API modules instead of importing from `@/data/categories`, `@/data/products`, `@/data/reviews`. Note: there is no backend "reviews across all products" endpoint yet (see Phase 6.3) — for `CustomerReviews.tsx`, either hide this section until Phase 6.3 ships, or temporarily leave it on mock data with a `// TODO(phase-6.3)` comment — do not block this step on a backend endpoint that doesn't exist yet.

### Step 4.2 — Shop page
Update `frontend/src/components/shop/ShopPageClient.tsx` and `frontend/src/components/shop/FilterSidebar.tsx` to call `listProducts()`/`listCategories()` instead of importing `@/data/products`, `@/data/categories`. Map the existing filter/sort UI state to the backend's `listProductsQuerySchema` query params (`q`, `category`, `minPrice`, `maxPrice`, `minRating`, `sort`, `page`, `limit` — see `backend/src/validators/product.validator.ts`).

### Step 4.3 — Product detail page
Update `frontend/src/app/(site)/product/[slug]/page.tsx`:
- Remove `generateStaticParams` and static generation — this page must become dynamic (`export const dynamic = "force-dynamic"`) since data now comes from a live database, not a build-time array.
- Replace `getProductBySlug`/`getRelatedProducts` imports from `@/data/products` with calls to `getProductBySlug()` from the Phase 3 API module (the backend already returns `related` products in the same response — see `backend/src/controllers/product.controller.ts`).

### Step 4.4 — Categories page
Update `frontend/src/app/(site)/categories/page.tsx` to call `listCategories()`/`listProducts()` instead of importing `@/data/categories`, `@/data/products`.

### Step 4.5 — Offers page
Update `frontend/src/app/(site)/offers/page.tsx` to call `listProducts()` (filter for whatever "offer" criteria the UI uses — check current mock logic in `@/data/products` for how "offers" are currently derived, and replicate that filter against the real API, e.g. products with `compareAtPriceBDT` set on a variant).

### Step 4.6 — Search overlay
Update `frontend/src/components/layout/SearchOverlay.tsx` to call `listProducts({ q: query })` instead of importing `@/data/products` and filtering client-side. Add debouncing (e.g. 300ms) since this now triggers a network request per keystroke.

### Step 4.7 — Account page (real auth)
Rewrite `frontend/src/app/(site)/account/page.tsx`:
- Replace the current `onSubmit={(e) => e.preventDefault()}` no-op with real calls to `AuthContext`'s `login()`/`register()`.
- Remove the "This is a frontend preview — account features are not yet connected" disclaimer text.
- Add basic error display (invalid credentials, validation errors from the backend).
- Add a logged-in state that shows the user's name/email and a logout button, and (if time allows in this step) a simple address list using `users.ts`'s `addAddress`/`removeAddress`.

### Step 4.8 — Cart/Wishlist product resolution
Update `frontend/src/context/CartContext.tsx` and `frontend/src/context/WishlistContext.tsx`: they currently resolve stored product/variant IDs against the static `@/data/products` array. Replace this with either (a) calling `getProductBySlug`/a new `getProductById` lookup per stored item, or (b) fetching full product details at add-to-cart time and storing a denormalized snapshot in `localStorage` instead of just IDs. Prefer (b) — it keeps cart/wishlist working even if a product's price changes elsewhere, and avoids N network calls every time the cart drawer opens. Document whichever choice is made in a code comment.

### Step 4.9 — Checkout → real order creation
Rewrite `frontend/src/components/checkout/CheckoutClient.tsx`:
- Replace the `handleSubmit` body (currently just `setOrderNumber(\`SAP-${Math.floor(100000 + Math.random() * 900000)}\`)`) with a real call to `createOrder()` from the Phase 3 `orders.ts` module, sending `items`, `shippingAddress`, `deliveryMethod`, `paymentMethod` matching `backend/src/validators/order.validator.ts`'s `createOrderSchema`.
- On success, clear the cart and route to an order-confirmation page showing the real order number and status returned by the backend (not a client-generated one).
- On failure (e.g. stock unavailable, validation error), show the backend's error message instead of silently succeeding.
- Remove the "a demo checkout — no payment has actually been processed" disclaimer once this is wired (COD orders are real at this point; still note in the UI that online payment methods are not yet processed until Phase 6.5 ships).
- Reconcile the shipping-fee display in this component with `backend/src/constants/shipping.ts`'s `computeShippingFee()` (standard/express fee + free-shipping-over-৳5000 threshold) so the frontend shows the same number the backend will actually charge.

### Step 4.10 — Full regression pass
```bash
cd frontend
npm run typecheck
npm run lint
npm run build
```
Manually click through every page in a browser against a running seeded backend: home, shop, product detail, categories, offers, search, cart, wishlist, account (register → logout → login), checkout (place a real COD order end to end). Fix anything broken before moving to Phase 5.

---

## PHASE 5 — Delete Now-Unnecessary Code (only after Phase 4 is fully verified)

**Do not do this phase before Phase 4 is complete and verified — deleting these files earlier will break the build.**

### Step 5.1 — Delete mock data files
Delete:
- `frontend/src/data/products.ts`
- `frontend/src/data/categories.ts`
- `frontend/src/data/reviews.ts` (only if Step 4.1's `CustomerReviews.tsx` TODO has since been resolved by Phase 6.3; otherwise keep it until then and delete in a follow-up pass)
- `frontend/src/data/bd-districts.ts` — **do not delete this one**; it is static reference data (Bangladesh district list for the address form dropdown), not mock product data, and has no backend equivalent. Keep it.

### Step 5.2 — Remove now-dead imports/helpers
Search the whole `frontend/src` tree for any remaining reference to `@/data/products`, `@/data/categories`, `@/data/reviews` and remove/replace anything Phase 4 missed.

### Step 5.3 — Remove leftover disclaimer/demo text
Grep for "not yet connected", "demo checkout", "no payment has actually been processed" and remove any instance Phase 4 didn't already clean up.

### Step 5.4 — Final verification
```bash
cd frontend
npm run typecheck
npm run lint
npm run build
```
Must be fully green with zero references to the deleted files.

---

## PHASE 6 — Implement Missing Backend Features (in priority order)

Each of these is an independent vertical slice (model → validator → service → controller → routes, following the existing pattern in `backend/src/`). Implement and verify (`npm run typecheck && npm run build && npm run lint && npm test`) after each one before starting the next.

### Step 6.1 — Forgot / Reset password
- Add `passwordResetToken` + `passwordResetExpires` fields to `backend/src/models/User.model.ts`.
- Add `POST /auth/forgot-password` (generates a token, would email it — see Step 6.4) and `POST /auth/reset-password` (validates token, sets new password, bumps `tokenVersion` to invalidate old sessions).
- Add corresponding frontend page(s) under `frontend/src/app/(site)/account/` or a new route.

### Step 6.2 — Public order tracking
- Add `GET /orders/track?orderNumber=...&email=...` (public, no auth) to `backend/src/routes/order.routes.ts` — verify email matches the order's shipping address email before returning data.
- Add a frontend page (e.g. `frontend/src/app/(site)/track-order/page.tsx`).

### Step 6.3 — Review: "recent reviews" + admin "list all"
- Add `GET /reviews/recent` (public, latest N reviews across all products, for the homepage) to `backend/src/routes/review.routes.ts` / `backend/src/controllers/review.controller.ts` / `backend/src/services/review.service.ts`.
- Add `GET /reviews` (staff-only, paginated, all reviews) for future admin moderation UI.
- Go back and resolve the `CustomerReviews.tsx` TODO from Step 4.1.

### Step 6.4 — Email service
- Add `backend/src/config/email.ts` (nodemailer or similar), gated behind env vars the same way `isCloudinaryConfigured` gates Cloudinary — fail gracefully (log a warning, don't crash) if SMTP credentials aren't set.
- Wire it into: order confirmation (on `createOrder` success), password reset (Step 6.1), staff account welcome email (on `createStaffAccount`).

### Step 6.5 — Payment gateway integration
- Pick one gateway to start (bKash or SSLCommerz recommended for Bangladesh).
- Add `backend/src/config/payment.ts` + a webhook/callback route that verifies the payment signature and updates `Order.isPaid`/`Order.paymentDetails` — do not trust any client-submitted "payment succeeded" flag.
- Update `frontend/src/components/checkout/CheckoutClient.tsx` to redirect to the gateway when a non-COD payment method is selected.

### Step 6.6 — Homepage CMS backend
- Add `backend/src/models/HeroSlide.model.ts`, `HomepageSection.model.ts`, `SiteSettings.model.ts`.
- Add CRUD routes under staff-only authorization, plus public `GET` routes for the frontend to consume.
- Update frontend homepage (Step 4.1) to fetch hero slides/sections dynamically once this exists, instead of the hardcoded component order.

### Step 6.7 — Employee HR backend
- Add models: `Attendance.model.ts`, `Leave.model.ts`, `Task.model.ts`, `PerformanceReview.model.ts`, `SalaryPayment.model.ts`.
- Add routes scoped correctly: employees can only read/write their own records; co_admin/admin can manage all staff records (reuse the `authorizeSelfOrRoles` middleware pattern already in `backend/src/middlewares/rbac.middleware.ts`).

### Step 6.8 — Reports backend
- Add aggregation-based endpoints (sales by day/week/month, inventory levels, attendance summary) once Step 6.7's data exists to report on.

---

## PHASE 7 — Build the Admin Portal (frontend)

- Scaffold `frontend/src/app/admin/` with its own layout (separate from the storefront `(site)` layout), protected by `AuthContext` (redirect to login if not `admin`/`super_admin`/`co_admin`).
- Build CRUD screens against the Phase 3 API modules (extend with admin-only calls: create/update/delete product, category, update order status, staff management) for: Products, Categories, Orders, Customers, Reviews, Staff.
- Wire Cloudinary image upload UI (multipart form) once real Cloudinary credentials are supplied by the project owner.

## PHASE 8 — Build the Employee Portal (frontend)

- Scaffold `frontend/src/app/employee/`, protected the same way, restricted to `employee` role (and staff roles above it where relevant).
- Build screens for: Dashboard, Attendance check-in/out, Leave request, Assigned tasks, Performance view, Salary history — against the Step 6.7 backend endpoints.

## PHASE 9 — Final Hardening & Deployment Prep

- Add backend integration tests against a real or in-memory MongoDB (the current test suite is unit-tests-only because no MongoDB was available in the original sandbox — this constraint may not apply in the environment this plan is executed in).
- Add a frontend test runner (e.g. Vitest + React Testing Library) and basic coverage for the new API-integrated components.
- Update `CLAUDE.md`/`README.md` to accurately reflect the implemented state at each phase boundary (do this incrementally, not just at the end).
- Production deployment checklist: hosting for both apps, environment variables set for production (real MongoDB URI, JWT secrets, Cloudinary, SMTP, payment gateway credentials), CORS `CLIENT_ORIGIN` set to the real frontend domain, HTTPS/SSL, monitoring/logging, database backups.

---

## Quick reference — verification commands by project

**Backend** (`cd backend`):
```bash
npm run typecheck
npm run build
npm run lint
npm test
```

**Frontend** (`cd frontend`):
```bash
npm run typecheck
npm run lint
npm run build
```

Run the relevant block after every step, not just at the end of a phase.

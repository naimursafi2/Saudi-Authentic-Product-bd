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

Not a git repository. There is no `.git` at the root — be extra careful with
destructive file operations since there's no version history to fall back on.

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

Core utilities (reuse, don't reinvent):
- `catchAsync(handler)` — wraps async route handlers, forwards rejections to `next`.
- `sendSuccess(res, statusCode, message, data?, meta?)` — response envelope `{success, message, data, ...meta}`.
- `ApiError.badRequest/unauthorized/forbidden/notFound/conflict/internal(message, errors?)`.
- `validate({ body?, query?, params? })` — zod-parses and **replaces** the field via
  `Object.defineProperty` (see below — plain reassignment breaks on Express 5).
- `authenticate` (JWT from `accessToken` cookie or `Authorization: Bearer`) +
  `authorize(...roles)` / `authorizeSelfOrRoles(getOwnerId, ...staffRoles)`.
- `paramStr(req.params.x)` — narrows Express's `string | string[]` param type.

**Auth**: httpOnly cookies `accessToken` / `refreshToken` (see `utils/cookies.ts`,
`utils/jwt.ts`). Roles: `customer | employee | co_admin | admin | super_admin`
(`constants/roles.ts`). No DB permission matrix — every route hand-lists
allowed roles via `authorize(...)`, matching existing convention. Convention:
co_admin can run day-to-day HR (attendance/leave/tasks/performance) but never
touches salary, staff role/status, or deletes — those are admin/super_admin only.

**Uploads**: `multer` (memory storage) → `uploadBufferToCloudinary()` in
`config/cloudinary.ts`. Guarded by `isCloudinaryConfigured`; returns a clear
503 if Cloudinary env vars are unset rather than a confusing SDK error.

**Email**: `services/email.service.ts` (templates) → `config/mailer.ts`
(nodemailer transporter) → guarded by `isSmtpConfigured`. **All email sends
are fire-and-forget (`void sendXEmail(...)`, never `await`)** — a real SMTP
round-trip is too slow to block the request, and `safeSend()` inside
`email.service.ts` already swallows and logs failures so callers never need
to handle rejections.

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

### Frontend (`frontend/src`)

```
app/(site)/...      Customer storefront (App Router route group)
app/admin/...        Admin / Co-Admin / Super Admin portal (role-guarded)
app/employee/...     Employee portal (role-guarded)
components/ui/       Shared primitives: Button, ProductCard, SectionHeading, ProductVisual, etc.
components/<domain>/ Feature components (checkout/, product/, shop/, account/, admin/, employee/)
context/              AuthContext, CartContext, WishlistContext (React context, "use client")
lib/api/              One file per backend resource (products.ts, orders.ts, attendance.ts, ...),
                      all built on lib/api/client.ts's `api.get/post/patch/delete/postForm/patchForm`
lib/mappers.ts        Converts raw API shapes (types/api.ts, types/hr.ts) into the
                      storefront view-model shapes (types/product.ts) components consume
lib/hooks/            useProducts, useCategories, useProductsByIds (cart/wishlist resolution)
lib/roles.ts          Frontend copy of backend's role constants (apps don't share code — keep in sync manually)
types/api.ts          Types mirroring backend Product/Order/User/Review/Category JSON
types/hr.ts            Types mirroring backend Attendance/Leave/Task/Performance/Salary/Inventory/Reports JSON
types/product.ts       Storefront view-model types (Product, Category, ProductVariant, ProductVisual)
```

**Data flow convention**: never fetch raw API shapes directly in a component.
Call the relevant `lib/api/*.ts` function, then map through `lib/mappers.ts`
(`toProduct`, `toCategory`, `toCustomerReview`) before handing data to a
component. This keeps components decoupled from Mongo's `_id`/populated-ref
shapes.

**Auth**: `AuthContext` hydrates from `GET /auth/me` on mount (cookie-based,
`credentials: "include"` on every request — set in `lib/api/client.ts`).
`status` is `"loading" | "authenticated" | "unauthenticated"`. Admin/Employee
routes are guarded client-side via `components/admin/RoleGuard.tsx` (checks
`useAuth()`, redirects to `/account` if the role doesn't match) — the API
enforces the real authorization server-side; the guard is UX-only.

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

**Design tokens** (`app/globals.css`, Tailwind v4 `@theme inline`): cream
(`cream-50..400`), green (`green-950/900/800`), gold (`gold-500/600/700`),
brown (`brown-500/600/700`), ink (`ink-900`). Fonts: EB Garamond
(`font-serif`, headings) + Plus Jakarta Sans (`font-sans`, body). Reuse
`cn()` and `formatBDT()` from `lib/utils.ts` and the primitives in
`components/ui/` — don't hand-roll new buttons/cards/headings.

## Environment / running locally

Both apps need `.env` (see `.env.example` in each). Already configured:
MongoDB Atlas, Cloudinary, SMTP.

```
backend:  npm run dev      (tsx watch, http://localhost:5000, API at /api/v1)
          npm run seed     (creates super admin + sample co_admin/employee accounts + categories + products)
          npm run typecheck / lint / test / build
frontend: npm run dev      (Next.js, http://localhost:3000)
          npm run typecheck / lint / build
```

`frontend/.env.example` documents `NEXT_PUBLIC_API_URL` (defaults to
`http://localhost:5000/api/v1` if unset — fine for local dev).

**Sandbox DNS note**: this dev sandbox's default resolver can't do the SRV
lookups `mongodb+srv://` needs, even though normal DNS works — a Node
`dns.setServers(["8.8.8.8","1.1.1.1"])` preload script fixes it for local
testing (`NODE_OPTIONS="-r <path-to-script>"`). This is a sandbox-only
workaround, not a code change — don't "fix" this in the app itself.

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

## Status (see conversation/plan history for the authoritative live list)

Done: backend HR/inventory/reports modules, SMTP email, full storefront
(products/categories/cart/wishlist/orders/reviews/auth) wired end-to-end and
browser-tested against the real API. In progress: Admin/Co-Admin/Super Admin
portal UI and Employee portal UI (`app/admin`, `app/employee`), frontend
route-guard middleware, final full-stack verification pass.

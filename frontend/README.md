# Saudi Authentic Product — Frontend

Premium, Saudi/Arabic-inspired e-commerce frontend for **Saudi Authentic Product**, built for the Bangladeshi market. This is a frontend-only implementation (no backend/API) built from the provided Figma design, using mock product data.

## Tech Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (CSS-based theme, see `src/app/globals.css`)
- **lucide-react** for icons
- Self-hosted fonts via `@fontsource` (EB Garamond + Plus Jakarta Sans) — no external Google Fonts network dependency
- Cart & wishlist persisted to `localStorage` via React Context

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Other scripts:

```bash
npm run build   # production build
npm run start   # run the production build
npm run lint    # eslint
```

## Folder Structure

```
src/
  app/                    # Next.js App Router pages
    (site)/               # Route group sharing the main Header/Footer layout
      page.tsx             # Home
      shop/                # Shop listing (search, filters, sort, pagination)
      product/[slug]/      # Product details (dynamic route)
      cart/                # Cart page
      wishlist/            # Wishlist page
      categories/          # Category grid
      about/, contact/, account/, shipping-policy/
    checkout/              # Checkout flow — uses its own stripped-down layout
    layout.tsx             # Root layout: fonts, providers, cart drawer
    globals.css            # Design tokens (colors, fonts) + Tailwind

  components/
    layout/                # Header, Footer, AnnouncementBar, CartDrawer, SearchOverlay
    home/                  # Homepage sections
    shop/                  # Filter sidebar, sort bar, pagination, shop state
    product/                # Gallery, info, description bento, related products
    checkout/               # Checkout form sections
    ui/                     # Reusable primitives: Button, ProductCard, StarRating, etc.

  context/                 # CartContext, WishlistContext (localStorage-backed)
  data/                    # Mock products, categories, reviews, BD districts
  types/                   # Shared TypeScript types
  lib/                     # Utilities (currency formatting, cn helper)
```

## Notes

- **Product imagery** is rendered as on-brand gradient placeholders (`ProductVisual`
  component) instead of photography, so the project runs anywhere with zero
  external image dependencies. Swap `ProductVisual` for real `<Image>` usage
  once real product photography is available — every call site already passes
  a single `visual` prop per product, so this is a one-component change.
- **Mock data** lives in `src/data/`. The `Product`/`Category` types in
  `src/types/product.ts` already include the future categories mentioned in
  the brief (Perfumes, Heritage Watches, Chocolates, Nuts) marked
  `comingSoon`, so adding real products later is just appending to the data
  files.
- **Cart / Wishlist / Search / Checkout** are fully interactive at the
  frontend level (persisted in `localStorage`), but checkout does not call
  any real payment API — "Complete Order" simply clears the cart and shows a
  confirmation screen.
 1
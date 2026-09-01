import { Suspense } from "react";
import type { Metadata } from "next";
import { ShopPageClient } from "@/components/shop/ShopPageClient";
import { listProducts } from "@/lib/api/products";
import { listCategories } from "@/lib/api/categories";
import { toProduct, toCategory } from "@/lib/mappers";

export const metadata: Metadata = {
  title: "Shop Authentic Saudi Dates & Gift Boxes",
  description:
    "Browse premium Saudi & Madinah dates and gift boxes, filterable by category, price and rating.",
};

/**
 * Products/categories used to be fetched inside `ShopPageClient` itself
 * (a "use client" component, via `useProducts`/`useCategories`), which meant
 * the very first visit to /shop in a browsing session always rendered an
 * empty grid + loading skeleton for a moment, then fetched, then painted —
 * a real loading flash on top of everything (site)/layout.tsx and next.config's
 * staleTimes already fixed for navigation itself. Fetching here instead means
 * the product grid is already part of the initial HTML/RSC payload — first
 * visit renders instantly, no skeleton, same as every repeat visit (which is
 * still served from the browser's Router Cache with no request at all).
 *
 * Products stay uncached on the server (no `revalidate`, same as before) —
 * price/stock must always be current. Categories reuse the layout's 60s
 * window since they're the same slow-changing list already shown in the
 * header dropdown.
 */
export default async function ShopPage() {
  const [productsResult, categoriesResult] = await Promise.allSettled([
    listProducts({ limit: 100 }),
    listCategories(false, 60),
  ]);

  const initialProducts =
    productsResult.status === "fulfilled"
      ? productsResult.value.data.products.map(toProduct)
      : [];
  const initialProductsError =
    productsResult.status === "rejected" ? "Could not load products." : null;

  const initialCategories =
    categoriesResult.status === "fulfilled"
      ? [...categoriesResult.value.data.categories]
          .map(toCategory)
          .sort((a, b) => a.sortOrder - b.sortOrder)
      : [];

  return (
    <Suspense fallback={null}>
      <ShopPageClient
        initialProducts={initialProducts}
        initialProductsError={initialProductsError}
        initialCategories={initialCategories}
      />
    </Suspense>
  );
}

import type { Product, ProductVariant } from "@/types/product";

/**
 * Stock is read straight off the product payload the API returns — there is
 * one live number per variant and no separate cached copy anywhere, so the
 * storefront, listings and portals all agree by construction. `lib/api/client.ts`
 * sets `cache: "no-store"` on every request, so these values are never stale.
 */
export function totalStock(product: Product): number {
  return product.variants.reduce((sum, v) => sum + v.stock, 0);
}

/** True when no variant of the product can be ordered at all. */
export function isStockOut(product: Product): boolean {
  return totalStock(product) === 0;
}

/** The variant a quick "Add to Cart" should use, or `undefined` if none is orderable. */
export function firstAvailableVariant(product: Product): ProductVariant | undefined {
  return product.variants.find((v) => v.stock > 0);
}

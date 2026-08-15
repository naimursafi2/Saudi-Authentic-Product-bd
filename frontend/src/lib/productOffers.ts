import type { Product, ProductVariant } from "@/types/product";

export interface ProductDeal {
  product: Product;
  variant: ProductVariant;
  discount: number;
}

/** The first variant with an active discount (compareAtPriceBDT > priceBDT), or null. */
export function getDiscountedVariant(product: Product): ProductVariant | null {
  const variant = product.variants.find(
    (v) => v.compareAtPriceBDT != null && v.compareAtPriceBDT > v.priceBDT
  );
  return variant ?? null;
}

/** Products with an active discount, paired with their discounted variant and % off. */
export function getProductDeals(products: Product[]): ProductDeal[] {
  return products
    .map((product) => {
      const variant = getDiscountedVariant(product);
      if (!variant?.compareAtPriceBDT) return null;
      const discount = Math.round(
        ((variant.compareAtPriceBDT - variant.priceBDT) / variant.compareAtPriceBDT) * 100
      );
      return { product, variant, discount };
    })
    .filter((deal): deal is ProductDeal => deal !== null);
}

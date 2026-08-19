import { describe, expect, it } from "vitest";
import { firstAvailableVariant, isStockOut, totalStock } from "./stock";
import type { Product, ProductVariant } from "@/types/product";

function makeProduct(variants: Partial<ProductVariant>[]): Product {
  return {
    id: "prod-1",
    slug: "ajwa-dates",
    name: "Ajwa Dates",
    tagline: "Rich, soft Madinah dates",
    description: "Premium Ajwa dates.",
    origin: "Madinah",
    categories: [],
    images: [],
    visual: { tone: "green", icon: "Package" },
    variants: variants.map((v, i) => ({
      id: v.id ?? `var-${i}`,
      label: v.label ?? `${(i + 1) * 500}g`,
      priceBDT: v.priceBDT ?? 1000,
      compareAtPriceBDT: v.compareAtPriceBDT,
      stock: v.stock ?? 0,
    })),
    highlights: [],
    ratingAverage: 0,
    ratingCount: 0,
    isBestSeller: false,
    isFeatured: false,
  } as unknown as Product;
}

describe("totalStock", () => {
  it("sums stock across every variant", () => {
    expect(totalStock(makeProduct([{ stock: 3 }, { stock: 7 }]))).toBe(10);
  });
});

describe("isStockOut", () => {
  it("is true only when no variant has any stock left", () => {
    expect(isStockOut(makeProduct([{ stock: 0 }, { stock: 0 }]))).toBe(true);
    expect(isStockOut(makeProduct([{ stock: 0 }, { stock: 1 }]))).toBe(false);
  });
});

describe("firstAvailableVariant", () => {
  it("skips sold-out variants so a quick add-to-cart picks something orderable", () => {
    const product = makeProduct([
      { id: "small", stock: 0 },
      { id: "large", stock: 4 },
    ]);
    expect(firstAvailableVariant(product)?.id).toBe("large");
  });

  it("returns undefined when the whole product is out of stock", () => {
    expect(firstAvailableVariant(makeProduct([{ stock: 0 }]))).toBeUndefined();
  });
});

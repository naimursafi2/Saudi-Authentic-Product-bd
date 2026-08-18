import { describe, expect, it } from "vitest";
import { getFallbackVisual, toCategory, toCustomerReview, toProduct } from "./mappers";
import type { ApiCategory, ApiProduct, ApiReview } from "@/types/api";

const baseApiProduct: ApiProduct = {
  _id: "prod-1",
  name: "Ajwa Dates",
  slug: "ajwa-dates",
  tagline: "Rich, soft Madinah dates",
  description: "Premium Ajwa dates sourced from Madinah.",
  origin: "Madinah, Saudi Arabia",
  categories: [{ _id: "cat-1", name: "Dates", slug: "dates" }],
  images: [],
  variants: [
    { _id: "var-1", label: "500g", priceBDT: 1200, stock: 20, lowStockThreshold: 5 },
  ],
  highlights: ["Hand-picked", "No preservatives"],
  ratingAverage: 4.5,
  ratingCount: 12,
  isBestSeller: true,
  isFeatured: false,
  isActive: true,
  minPriceBDT: 1200,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("getFallbackVisual", () => {
  it("is deterministic for the same seed", () => {
    expect(getFallbackVisual("ajwa-dates")).toEqual(getFallbackVisual("ajwa-dates"));
  });

  it("returns a tone and icon from the known sets", () => {
    const visual = getFallbackVisual("some-random-slug");
    expect(["green", "cream", "gold", "brown", "plum"]).toContain(visual.tone);
    expect(["Package", "Gift", "Droplet", "Watch", "Leaf", "Sparkles", "Nut"]).toContain(visual.icon);
  });
});

describe("toProduct", () => {
  it("maps a populated-category API product into the storefront view model", () => {
    const product = toProduct(baseApiProduct);

    expect(product.id).toBe("prod-1");
    expect(product.slug).toBe("ajwa-dates");
    expect(product.categories).toEqual([{ id: "cat-1", name: "Dates", slug: "dates" }]);
    expect(product.variants).toEqual([
      { id: "var-1", label: "500g", priceBDT: 1200, compareAtPriceBDT: undefined, stock: 20 },
    ]);
    expect(product.isBestSeller).toBe(true);
  });

  it("falls back to a blank category name/slug when categories are unpopulated ids", () => {
    const product = toProduct({ ...baseApiProduct, categories: ["cat-1"] });
    expect(product.categories).toEqual([{ id: "cat-1", name: "", slug: "" }]);
  });
});

describe("toCategory", () => {
  it("maps an API category, including an uploaded image when present", () => {
    const apiCategory: ApiCategory = {
      _id: "cat-1",
      name: "Dates",
      slug: "dates",
      isComingSoon: false,
      sortOrder: 1,
      isActive: true,
      image: { url: "https://cdn.example.com/dates.jpg", publicId: "dates-1" },
    };

    const category = toCategory(apiCategory);
    expect(category.image).toEqual({ url: "https://cdn.example.com/dates.jpg", publicId: "dates-1" });
    expect(category.comingSoon).toBe(false);
  });
});

describe("toCustomerReview", () => {
  it("uses the populated customer's name and its initial", () => {
    const apiReview = {
      _id: "rev-1",
      customer: { _id: "user-1", name: "Fatima Rahman" },
      rating: 5,
      comment: "Best dates I've had.",
    } as unknown as ApiReview;

    const review = toCustomerReview(apiReview);
    expect(review.author).toBe("Fatima Rahman");
    expect(review.initial).toBe("F");
    expect(review.quote).toBe("Best dates I've had.");
  });

  it("falls back to 'Verified Customer' when the customer is an unpopulated id", () => {
    const apiReview = {
      _id: "rev-2",
      customer: "user-2",
      rating: 4,
      comment: "Great quality.",
    } as unknown as ApiReview;

    expect(toCustomerReview(apiReview).author).toBe("Verified Customer");
  });
});

import type { ApiCategory, ApiProduct, ApiReview } from "@/types/api";
import type { Category, CustomerReview, Product, ProductVisual } from "@/types/product";

const TONES: ProductVisual["tone"][] = ["green", "cream", "gold", "brown", "plum"];
const ICONS: ProductVisual["icon"][] = ["Package", "Gift", "Droplet", "Watch", "Leaf", "Sparkles", "Nut"];

/** Small deterministic string hash — same seed always picks the same tone/icon. */
function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Decorative visual used in place of real photography until one is uploaded. */
export function getFallbackVisual(seed: string): ProductVisual {
  const hash = hashSeed(seed);
  return {
    tone: TONES[hash % TONES.length],
    icon: ICONS[Math.floor(hash / TONES.length) % ICONS.length],
  };
}

export function toProduct(api: ApiProduct): Product {
  return {
    id: api._id,
    slug: api.slug,
    name: api.name,
    tagline: api.tagline,
    description: api.description,
    origin: api.origin,
    categories: api.categories.map((c) =>
      typeof c === "string" ? { id: c, name: "", slug: "" } : { id: c._id, name: c.name, slug: c.slug }
    ),
    images: api.images,
    visual: getFallbackVisual(api.slug),
    badge: api.badge,
    ratingAverage: api.ratingAverage,
    ratingCount: api.ratingCount,
    variants: api.variants.map((v) => ({
      id: v._id,
      label: v.label,
      priceBDT: v.priceBDT,
      compareAtPriceBDT: v.compareAtPriceBDT,
      stock: v.stock,
    })),
    highlights: api.highlights,
    storageInstructions: api.storageInstructions,
    isBestSeller: api.isBestSeller,
    isFeatured: api.isFeatured,
  };
}

export function toCategory(api: ApiCategory): Category {
  return {
    id: api._id,
    slug: api.slug,
    name: api.name,
    description: api.description,
    image: api.image ? { url: api.image.url, publicId: api.image.publicId } : undefined,
    visual: getFallbackVisual(api.slug),
    comingSoon: api.isComingSoon,
    sortOrder: api.sortOrder,
  };
}

export function toCustomerReview(api: ApiReview): CustomerReview {
  const authorName = typeof api.customer === "string" ? "Verified Customer" : api.customer.name;
  return {
    id: api._id,
    author: authorName,
    initial: authorName.charAt(0).toUpperCase(),
    rating: api.rating,
    quote: api.comment,
  };
}

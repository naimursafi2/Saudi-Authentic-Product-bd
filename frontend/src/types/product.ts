/**
 * Storefront view-model types. Components consume these (never the raw API
 * shapes in `types/api.ts` directly) — `lib/mappers.ts` converts real API
 * responses into this shape, which keeps components stable regardless of
 * backend field-naming (`_id` vs `id`, populated refs, etc).
 */

export type VisualTone = "green" | "cream" | "gold" | "brown" | "plum";

/** Name of a lucide-react icon component used to render the decorative product visual. */
export type VisualIconName =
  | "Package"
  | "Gift"
  | "Droplet"
  | "Watch"
  | "Leaf"
  | "Sparkles"
  | "Nut";

export interface ProductVisual {
  tone: VisualTone;
  icon: VisualIconName;
}

export interface ProductImage {
  url: string;
  publicId: string;
  isPrimary?: boolean;
}

export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description?: string;
  image?: ProductImage;
  /** Deterministic fallback used until the category has a real uploaded image. */
  visual: ProductVisual;
  comingSoon: boolean;
  sortOrder: number;
}

export interface ProductVariant {
  id: string;
  label: string; // e.g. "500g", "1kg", "2kg"
  priceBDT: number;
  compareAtPriceBDT?: number;
  stock: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  origin: string;
  categories: CategoryRef[];
  images: ProductImage[];
  /** Deterministic fallback used until the product has real uploaded photos. */
  visual: ProductVisual;
  badge?: "Authentic" | "Best Seller" | "New" | "Limited";
  ratingAverage: number;
  ratingCount: number;
  variants: ProductVariant[];
  highlights: string[];
  storageInstructions?: string;
  isBestSeller?: boolean;
  isFeatured?: boolean;
}

export interface CartLine {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface CustomerReview {
  id: string;
  author: string;
  initial: string;
  rating: number;
  quote: string;
}

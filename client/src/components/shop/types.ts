export type SortOption = "featured" | "price-asc" | "price-desc" | "rating" | "newest";

export interface ShopFilters {
  query: string;
  categories: string[];
  /**
   * Product.origin values, e.g. "Madinah, Saudi Arabia". This stands in for
   * the usual "Brands" facet — the Product model has no brand field, and
   * origin is the closest thing the catalogue actually stores. The options
   * are derived from the loaded products, never hardcoded, so the facet
   * can't offer a value nothing matches.
   */
  origins: string[];
  /** Product.badge values ("Best Seller", "New", "Limited", "Authentic"). */
  badges: string[];
  minPrice: number | null;
  maxPrice: number | null;
  inStockOnly: boolean;
  onSaleOnly: boolean;
  sort: SortOption;
}

export const DEFAULT_FILTERS: ShopFilters = {
  query: "",
  categories: [],
  origins: [],
  badges: [],
  minPrice: null,
  maxPrice: null,
  inStockOnly: false,
  onSaleOnly: false,
  sort: "featured",
};

export const SORT_LABELS: Record<SortOption, string> = {
  featured: "Featured",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  rating: "Highest Rated",
  newest: "Newest",
};

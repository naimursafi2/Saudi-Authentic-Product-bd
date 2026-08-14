export type SortOption = "featured" | "price-asc" | "price-desc" | "rating" | "newest";

export interface ShopFilters {
  query: string;
  categories: string[];
  minPrice: number | null;
  maxPrice: number | null;
  minRating: number;
  sort: SortOption;
}

export const DEFAULT_FILTERS: ShopFilters = {
  query: "",
  categories: [],
  minPrice: null,
  maxPrice: null,
  minRating: 0,
  sort: "featured",
};

export const SORT_LABELS: Record<SortOption, string> = {
  featured: "Featured",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  rating: "Highest Rated",
  newest: "Newest",
};

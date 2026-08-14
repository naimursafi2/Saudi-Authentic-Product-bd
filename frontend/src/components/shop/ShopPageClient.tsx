"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { useProducts } from "@/lib/hooks/useProducts";
import { useCategories } from "@/lib/hooks/useCategories";
import { ProductCard } from "@/components/ui/ProductCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FilterSidebar } from "./FilterSidebar";
import { SortBar } from "./SortBar";
import { Pagination } from "./Pagination";
import { DEFAULT_FILTERS, type ShopFilters } from "./types";

const PAGE_SIZE = 6;

export function ShopPageClient() {
  const searchParams = useSearchParams();
  const { products, isLoading, error } = useProducts({ limit: 100 });
  const { categories } = useCategories();
  const [filters, setFilters] = useState<ShopFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Sync filters from the URL (e.g. a category link from the homepage, or a
  // header search) whenever the query string changes. This mirrors external
  // (URL) state into the component.
  useEffect(() => {
    const category = searchParams.get("category");
    const query = searchParams.get("q");
    if (!category && query == null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilters((prev) => ({
      ...prev,
      categories: category ? [category] : prev.categories,
      query: query ?? prev.query,
    }));
    setPage(1);
    // Only run when the URL params actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  /** Update filters and reset back to page 1, used by every filter control. */
  function updateFilters(next: ShopFilters | ((prev: ShopFilters) => ShopFilters)) {
    setFilters(next);
    setPage(1);
  }

  const filtered = useMemo(() => {
    let list = products.slice();

    if (filters.query.trim()) {
      const q = filters.query.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.tagline.toLowerCase().includes(q) ||
          p.origin.toLowerCase().includes(q)
      );
    }

    if (filters.categories.length > 0) {
      list = list.filter((p) =>
        p.categories.some((c) => filters.categories.includes(c.slug))
      );
    }

    if (filters.minPrice != null) {
      list = list.filter((p) => p.variants[0].priceBDT >= filters.minPrice!);
    }
    if (filters.maxPrice != null) {
      list = list.filter((p) => p.variants[0].priceBDT <= filters.maxPrice!);
    }

    if (filters.minRating > 0) {
      list = list.filter((p) => p.ratingAverage >= filters.minRating);
    }

    switch (filters.sort) {
      case "price-asc":
        list.sort((a, b) => a.variants[0].priceBDT - b.variants[0].priceBDT);
        break;
      case "price-desc":
        list.sort((a, b) => b.variants[0].priceBDT - a.variants[0].priceBDT);
        break;
      case "rating":
        list.sort((a, b) => b.ratingAverage - a.ratingAverage);
        break;
      case "newest":
        list.sort((a, b) => (a.id < b.id ? 1 : -1));
        break;
      default:
        list.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
    }

    return list;
  }, [filters, products]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10 sm:px-10 lg:px-16 lg:py-14">
      <div className="mb-10">
        <SectionHeading title="Shop All Products" align="left" dividerWidth={64} />
      </div>
      <div className="flex flex-col gap-10 lg:flex-row">
        <FilterSidebar
          filters={filters}
          categories={categories}
          onChange={updateFilters}
          onApplyPrice={(min, max) =>
            updateFilters((prev) => ({
              ...prev,
              minPrice: min ? Number(min) : null,
              maxPrice: max ? Number(max) : null,
            }))
          }
          className="hidden lg:flex lg:w-[260px] lg:shrink-0"
        />

        <div className="flex flex-1 flex-col gap-8">
          <SortBar
            count={filtered.length}
            total={filtered.length}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            sort={filters.sort}
            onSortChange={(sort) => updateFilters((prev) => ({ ...prev, sort }))}
            onOpenMobileFilters={() => setMobileFiltersOpen(true)}
          />

          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[4/5] w-full animate-pulse rounded-lg bg-cream-300" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 rounded border border-dashed border-brown-500/30 py-24 text-center">
              <p className="text-base font-semibold text-green-950">{error}</p>
            </div>
          ) : pageItems.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded border border-dashed border-brown-500/30 py-24 text-center">
              <p className="text-base font-semibold text-green-950">
                No products match your filters
              </p>
              <button
                onClick={() => updateFilters(DEFAULT_FILTERS)}
                className="text-xs font-bold uppercase tracking-[0.1em] text-brown-600 underline hover:text-green-950"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {pageItems.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} />
        </div>
      </div>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-[95] lg:hidden">
          <button
            aria-label="Close filters"
            className="absolute inset-0 bg-green-950/40"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[85%] max-w-sm animate-slide-in-right overflow-y-auto bg-cream-100 p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-serif text-xl text-green-950">Filters</span>
              <button
                aria-label="Close filters"
                onClick={() => setMobileFiltersOpen(false)}
              >
                <X size={20} className="text-green-950" />
              </button>
            </div>
            <FilterSidebar
              filters={filters}
              categories={categories}
              onChange={updateFilters}
              onApplyPrice={(min, max) =>
                updateFilters((prev) => ({
                  ...prev,
                  minPrice: min ? Number(min) : null,
                  maxPrice: max ? Number(max) : null,
                }))
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

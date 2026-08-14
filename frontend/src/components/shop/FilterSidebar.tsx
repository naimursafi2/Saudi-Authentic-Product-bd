"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/product";
import type { ShopFilters } from "./types";

interface FilterSidebarProps {
  filters: ShopFilters;
  categories: Category[];
  onChange: (filters: ShopFilters) => void;
  onApplyPrice: (min: string, max: string) => void;
  className?: string;
}

const RATING_OPTIONS = [5, 4, 3];

export function FilterSidebar({ filters, categories, onChange, onApplyPrice, className }: FilterSidebarProps) {
  function toggleCategory(slug: string) {
    const next = filters.categories.includes(slug)
      ? filters.categories.filter((c) => c !== slug)
      : [...filters.categories, slug];
    onChange({ ...filters, categories: next });
  }

  return (
    <aside className={cn("flex w-full flex-col gap-8", className)}>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brown-500" />
        <input
          type="search"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="Search products..."
          className="w-full rounded border border-green-900/15 bg-cream-100 py-2.5 pl-9 pr-3 text-sm text-green-950 placeholder:text-brown-500/60 focus:border-green-900/40 focus:outline-none"
        />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold text-green-950">Categories</h3>
        <ul className="flex flex-col gap-2.5">
          {categories
            .filter((c) => !c.comingSoon)
            .map((category) => (
              <li key={category.slug}>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-brown-600 hover:text-green-950">
                  <input
                    type="checkbox"
                    checked={filters.categories.includes(category.slug)}
                    onChange={() => toggleCategory(category.slug)}
                    className="size-4 rounded-sm border-brown-500/40 accent-green-900"
                  />
                  {category.name}
                </label>
              </li>
            ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold text-green-950">Price (BDT)</h3>
        <PriceFilter filters={filters} onApplyPrice={onApplyPrice} />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold text-green-950">Rating</h3>
        <ul className="flex flex-col gap-2.5">
          {RATING_OPTIONS.map((rating) => (
            <li key={rating}>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-brown-600 hover:text-green-950">
                <input
                  type="radio"
                  name="rating"
                  checked={filters.minRating === rating}
                  onChange={() =>
                    onChange({
                      ...filters,
                      minRating: filters.minRating === rating ? 0 : rating,
                    })
                  }
                  className="size-4 accent-green-900"
                />
                <span className="flex items-center gap-0.5 text-gold-500">
                  {"★".repeat(rating)}
                  <span className="text-brown-500/30">{"★".repeat(5 - rating)}</span>
                </span>
                <span>&amp; Up</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function PriceFilter({
  filters,
  onApplyPrice,
}: {
  filters: ShopFilters;
  onApplyPrice: (min: string, max: string) => void;
}) {
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const min = (form.elements.namedItem("min") as HTMLInputElement).value;
        const max = (form.elements.namedItem("max") as HTMLInputElement).value;
        onApplyPrice(min, max);
      }}
    >
      <div className="flex items-center gap-2">
        <input
          name="min"
          type="number"
          min={0}
          defaultValue={filters.minPrice ?? ""}
          placeholder="Min"
          className="w-full rounded border border-green-900/15 bg-cream-100 px-2.5 py-2 text-sm text-green-950 placeholder:text-brown-500/60 focus:border-green-900/40 focus:outline-none"
        />
        <span className="h-px w-3 shrink-0 bg-brown-500/40" />
        <input
          name="max"
          type="number"
          min={0}
          defaultValue={filters.maxPrice ?? ""}
          placeholder="Max"
          className="w-full rounded border border-green-900/15 bg-cream-100 px-2.5 py-2 text-sm text-green-950 placeholder:text-brown-500/60 focus:border-green-900/40 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        className="w-full rounded bg-cream-300 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-green-950 hover:bg-cream-400"
      >
        Apply Filter
      </button>
    </form>
  );
}

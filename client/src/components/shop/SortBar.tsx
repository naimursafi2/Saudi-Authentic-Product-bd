"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { SORT_LABELS, type SortOption } from "./types";

interface SortBarProps {
  count: number;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  onOpenMobileFilters: () => void;
}

export function SortBar({
  count,
  total,
  rangeStart,
  rangeEnd,
  sort,
  onSortChange,
  onOpenMobileFilters,
}: SortBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileFilters}
          className="flex cursor-pointer items-center gap-1.5 rounded border border-green-900/20 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-green-950 lg:hidden"
        >
          <SlidersHorizontal size={14} /> Filters
        </button>
        <p className="text-sm text-brown-500">
          {total === 0
            ? "No products found"
            : `Showing ${rangeStart}–${rangeEnd} of ${count} products`}
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm text-brown-500">
        Sort by:
        <span className="relative">
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="appearance-none rounded border-none bg-transparent py-1 pl-1 pr-6 text-sm font-bold text-green-950 focus:outline-none"
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-green-950"
          />
        </span>
      </label>
    </div>
  );
}

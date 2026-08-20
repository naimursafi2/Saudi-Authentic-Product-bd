"use client";

import { cn, formatBDT } from "@/lib/utils";
import type { Category } from "@/types/product";
import type { ShopFilters } from "./types";

interface FilterSidebarProps {
  filters: ShopFilters;
  categories: Category[];
  /** Distinct `origin` values across the loaded products, in display order. */
  origins: string[];
  /** Distinct `badge` values across the loaded products. */
  badges: string[];
  /** Lowest/highest product price in the catalogue — the slider's end stops. */
  priceBounds: { min: number; max: number };
  onChange: (filters: ShopFilters) => void;
  onPriceChange: (min: number | null, max: number | null) => void;
  onReset: () => void;
  className?: string;
}

const CHECKBOX_CLASS = "size-4 shrink-0 rounded-sm border-brown-500/40 accent-green-900";
const OPTION_CLASS =
  "flex cursor-pointer items-center gap-2.5 text-sm text-brown-600 transition-colors hover:text-green-950";

/** Each facet is its own bordered panel, so the sidebar reads as a stack of
 * discrete filter groups rather than one long undifferentiated column. */
function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-brown-600/15 bg-surface p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-green-950">{title}</h3>
      {children}
    </section>
  );
}

/**
 * The shop page's filter panel.
 *
 * Every facet here is backed by a field the Product model actually stores —
 * categories, price, origin, badge, stock and compare-at price.
 * There is deliberately no "Brands" facet: the model has no brand field, so
 * Origin stands in for it. Don't add a facet without a real field behind it;
 * an option that matches nothing is worse than no option.
 *
 * There is also no Rating facet (removed on request). "Highest Rated"
 * remains available as a *sort* option in `SortBar`, which is a separate
 * control — don't confuse the two if reinstating anything here.
 */
export function FilterSidebar({
  filters,
  categories,
  origins,
  badges,
  priceBounds,
  onChange,
  onPriceChange,
  onReset,
  className,
}: FilterSidebarProps) {
  function toggleIn(key: "categories" | "origins" | "badges", value: string) {
    const current = filters[key];
    const next = current.includes(value)
      ? current.filter((c) => c !== value)
      : [...current, value];
    onChange({ ...filters, [key]: next });
  }

  const activeCount =
    (filters.query.trim() ? 1 : 0) +
    filters.categories.length +
    filters.origins.length +
    filters.badges.length +
    (filters.minPrice != null || filters.maxPrice != null ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0) +
    (filters.onSaleOnly ? 1 : 0);

  return (
    <aside className={cn("flex w-full flex-col gap-4", className)}>
      <div className="flex items-center justify-between px-1">
        <h2 className="font-serif text-lg text-green-950">Filters</h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="cursor-pointer text-xs font-bold uppercase tracking-[0.06em] text-brown-600 underline underline-offset-2 hover:text-green-950"
          >
            Clear ({activeCount})
          </button>
        )}
      </div>

      {/* No search box here on purpose: the header's own search bar already
          covers it, and `filters.query` is still applied — it's populated
          from `?q=` by ShopPageClient. A second input would just duplicate
          the header's. */}

      {priceBounds.max > priceBounds.min && (
        <FilterSection title="Price (BDT)">
          <PriceRangeSlider
            bounds={priceBounds}
            minPrice={filters.minPrice}
            maxPrice={filters.maxPrice}
            onPriceChange={onPriceChange}
          />
        </FilterSection>
      )}

      {categories.filter((c) => !c.comingSoon).length > 0 && (
        <FilterSection title="Categories">
          <ul className="flex flex-col gap-2.5">
            {categories
              .filter((c) => !c.comingSoon)
              .map((category) => (
                <li key={category.slug}>
                  <label className={OPTION_CLASS}>
                    <input
                      type="checkbox"
                      checked={filters.categories.includes(category.slug)}
                      onChange={() => toggleIn("categories", category.slug)}
                      className={CHECKBOX_CLASS}
                    />
                    {category.name}
                  </label>
                </li>
              ))}
          </ul>
        </FilterSection>
      )}

      {/* Stands in for "Brands" — see the component comment. Hidden entirely
          when the catalogue has fewer than two distinct origins, since a
          one-option facet can only ever be a no-op. */}
      {origins.length > 1 && (
        <FilterSection title="Origin">
          <ul className="flex flex-col gap-2.5">
            {origins.map((origin) => (
              <li key={origin}>
                <label className={OPTION_CLASS}>
                  <input
                    type="checkbox"
                    checked={filters.origins.includes(origin)}
                    onChange={() => toggleIn("origins", origin)}
                    className={CHECKBOX_CLASS}
                  />
                  {origin}
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      )}

      {/* Always rendered: even with no badges in the catalogue, "On Sale"
          below is still a meaningful flag. */}
      <FilterSection title="Product Flags">
          <ul className="flex flex-col gap-2.5">
            {badges.map((badge) => (
              <li key={badge}>
                <label className={OPTION_CLASS}>
                  <input
                    type="checkbox"
                    checked={filters.badges.includes(badge)}
                    onChange={() => toggleIn("badges", badge)}
                    className={CHECKBOX_CLASS}
                  />
                  {badge}
                </label>
              </li>
            ))}
            {/* On Sale is computed from compareAtPriceBDT rather than being a
                badge value, so it lives here alongside them but is its own flag. */}
            <li>
              <label className={OPTION_CLASS}>
                <input
                  type="checkbox"
                  checked={filters.onSaleOnly}
                  onChange={() => onChange({ ...filters, onSaleOnly: !filters.onSaleOnly })}
                  className={CHECKBOX_CLASS}
                />
                On Sale
              </label>
            </li>
          </ul>
      </FilterSection>

      <FilterSection title="Availability">
        <label className={OPTION_CLASS}>
          <input
            type="checkbox"
            checked={filters.inStockOnly}
            onChange={() => onChange({ ...filters, inStockOnly: !filters.inStockOnly })}
            className={CHECKBOX_CLASS}
          />
          In Stock Only
        </label>
      </FilterSection>
    </aside>
  );
}

/**
 * Dual-handle price range slider — two overlaid native `<input type="range">`
 * elements sharing one track, so there is no new dependency (the project
 * deliberately carries no UI/form libraries).
 *
 * It is FULLY CONTROLLED off `filters.minPrice`/`maxPrice`: every drag
 * updates the parent immediately, so the product grid filters live rather
 * than waiting for an Apply button (which is why that button is gone).
 * Keeping no local drag state also means "Clear" resets the handles for
 * free — there is no second copy of the value to fall out of sync.
 *
 * A handle sitting exactly on its end stop reports `null` rather than the
 * bound, so "full range" means "no price filter applied" and the Clear
 * counter doesn't count an untouched slider as an active filter.
 */
function PriceRangeSlider({
  bounds,
  minPrice,
  maxPrice,
  onPriceChange,
}: {
  bounds: { min: number; max: number };
  minPrice: number | null;
  maxPrice: number | null;
  onPriceChange: (min: number | null, max: number | null) => void;
}) {
  const lo = minPrice ?? bounds.min;
  const hi = maxPrice ?? bounds.max;

  // One step per ~1% of the span, rounded to a tidy number, so dragging feels
  // smooth on a wide catalogue without emitting hundreds of updates.
  const step = Math.max(10, Math.round((bounds.max - bounds.min) / 100 / 10) * 10);

  function emit(nextLo: number, nextHi: number) {
    onPriceChange(
      nextLo <= bounds.min ? null : nextLo,
      nextHi >= bounds.max ? null : nextHi
    );
  }

  // Handles must not cross: each is clamped to the other's current position.
  function handleLo(value: number) {
    emit(Math.min(value, hi), hi);
  }
  function handleHi(value: number) {
    emit(lo, Math.max(value, lo));
  }

  const span = bounds.max - bounds.min;
  const loPct = ((lo - bounds.min) / span) * 100;
  const hiPct = ((hi - bounds.min) / span) * 100;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm font-semibold text-green-950">
        <span>{formatBDT(lo)}</span>
        <span>{formatBDT(hi)}</span>
      </div>

      <div className="relative h-5">
        {/* Track + the selected span highlighted between the two handles. */}
        <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-cream-400" />
        <span
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-brand-deep-2"
          style={{ left: `${loPct}%`, width: `${Math.max(0, hiPct - loPct)}%` }}
        />
        {/* Both inputs span the full track. `pointer-events` is disabled on
            the input itself and re-enabled on the thumb only, so a click on
            the bare track never hijacks the wrong handle and the upper
            input can't block the lower one. */}
        <input
          type="range"
          aria-label="Minimum price"
          min={bounds.min}
          max={bounds.max}
          step={step}
          value={lo}
          onChange={(e) => handleLo(Number(e.target.value))}
          className="range-thumb absolute inset-x-0 top-0 h-5 w-full appearance-none bg-transparent"
        />
        <input
          type="range"
          aria-label="Maximum price"
          min={bounds.min}
          max={bounds.max}
          step={step}
          value={hi}
          onChange={(e) => handleHi(Number(e.target.value))}
          className="range-thumb absolute inset-x-0 top-0 h-5 w-full appearance-none bg-transparent"
        />
      </div>
    </div>
  );
}

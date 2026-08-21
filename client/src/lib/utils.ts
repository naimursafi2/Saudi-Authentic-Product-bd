import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classnames safely, allowing conditional classes. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as Bangladeshi Taka, e.g. 2400 -> "৳ 2,400" */
export function formatBDT(amount: number): string {
  const formatted = new Intl.NumberFormat("en-IN").format(Math.round(amount));
  return `৳ ${formatted}`;
}

/**
 * Like `formatBDT` but keeps two decimals. Used for derived per-unit
 * figures — a landed unit cost of 412.50 rounds to 413 under `formatBDT`,
 * which hides exactly the difference the cost breakdown exists to show.
 */
export function formatBDTPrecise(amount: number): string {
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `৳ ${formatted}`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/**
 * The one responsive column scale every product-card grid uses — shop,
 * homepage rails, category results, wishlist, offers and search. Defined
 * once so the breakpoints can't drift apart page to page.
 *
 *   base (<640px)   2 columns — small phones included. This used to be a
 *                   single column, which wasted most of the screen and made
 *                   the page a long vertical scroll.
 *   sm  (>=640px)   3 columns — large phones / small tablets
 *   lg  (>=1024px)  4 columns — tablets / small desktops
 *   xl  (>=1280px)  5 columns — large desktops (was capped at 4)
 *
 * The gap steps up with the breakpoint so two cards side by side on a
 * 400px phone stay readable rather than cramped.
 */
export const PRODUCT_GRID_CLASS =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5";

/**
 * The shop/listing page's column scale — one column narrower than
 * `PRODUCT_GRID_CLASS` at every step above small mobile, because the shop
 * gives up horizontal room to its filter sidebar. It still never drops
 * below 2 columns, so small phones show a proper grid rather than a single
 * stacked column.
 *
 *   base (<640px)   2 columns   (same floor as the homepage — never below 2)
 *   sm  (>=640px)   2 columns   (home: 3)
 *   lg  (>=1024px)  3 columns   (home: 4)
 *   xl  (>=1280px)  4 columns   (home: 5)
 */
export const SHOP_GRID_CLASS =
  "grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4";

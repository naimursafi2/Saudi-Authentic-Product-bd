"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { cn, formatBDT } from "@/lib/utils";
import { useProductSearchSuggestions } from "@/hooks/useProductSearchSuggestions";
import { ProductMedia } from "@/components/ui/ProductMedia";

/**
 * The always-visible search field in the header's top row.
 *
 * Submitting navigates to `/shop?q=…`, which ShopPageClient already reads
 * and filters on — no new endpoint or search page was needed. While typing,
 * it also shows a live suggestions dropdown below the input, backed by the
 * same `useProductSearchSuggestions` hook (debounced `/products?q=` fetch +
 * client-side ranking) that powers `SearchOverlay`, so desktop and mobile
 * suggestions can never drift out of sync. `SearchOverlay` itself still
 * exists as the compact-screen entry point, opened from the header's search
 * icon on small screens where there is no room for this bar.
 *
 * The dropdown is rendered through a portal to `document.body` rather than
 * as a normal absolutely-positioned child: the header's row 2 nav sits right
 * below this bar and animates via `transform` (its scroll hide/show), which
 * gives it its own stacking context that always paints over an in-place
 * child of row 1 no matter how high that child's own `z-index` is set. A
 * portal escapes that trap entirely instead of trying to out-rank it.
 */
export function HeaderSearchBar({ className }: { className?: string }) {
  const [value, setValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { results, isSearching } = useProductSearchSuggestions(value);

  const trimmed = value.trim();
  const showDropdown = isOpen && trimmed.length > 0;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!showDropdown) return;

    function updateRect() {
      const box = containerRef.current?.getBoundingClientRect();
      if (box) {
        setRect({ top: box.bottom + 8, left: box.left, width: box.width });
      }
    }

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [showDropdown]);

  useEffect(() => {
    if (!showDropdown) return;

    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showDropdown]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsOpen(false);
    router.push(trimmed ? `/shop?q=${encodeURIComponent(trimmed)}` : "/shop");
  }

  function isFocusStillInside(next: Node | null) {
    if (next && containerRef.current?.contains(next)) return true;
    if (next && dropdownRef.current?.contains(next)) return true;
    return false;
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      onFocus={() => setIsOpen(true)}
      onBlur={(e) => {
        if (!isFocusStillInside(e.relatedTarget as Node | null)) {
          setIsOpen(false);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setIsOpen(false);
      }}
    >
      <form
        onSubmit={handleSubmit}
        role="search"
        className="flex w-full items-center gap-2 rounded-full border border-green-950/12 bg-surface px-4 py-2 transition-colors focus-within:border-gold-500/60"
      >
        <Search size={16} className="shrink-0 text-brown-500" />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search for dates, gift boxes…"
          aria-label="Search products"
          className="min-w-0 flex-1 bg-transparent text-sm text-green-950 outline-none placeholder:text-brown-500/70"
        />
        <button
          type="submit"
          className="shrink-0 cursor-pointer rounded-full bg-brand-deep px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-on-brand transition-colors hover:bg-brand-deep-2"
        >
          Search
        </button>
      </form>

      {mounted &&
        showDropdown &&
        rect &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ top: rect.top, left: rect.left, width: rect.width }}
            className="fixed z-[100] max-h-[60vh] overflow-y-auto rounded-2xl border border-green-950/10 bg-surface shadow-[0_18px_48px_rgba(12,36,22,0.18)]"
          >
            {isSearching ? (
              <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-brown-500">
                <span className="inline-block size-2 animate-pulse rounded-full bg-gold-500" />
                Searching...
              </div>
            ) : results.length === 0 ? (
              <div className="px-4 py-5 text-center text-sm text-brown-500">
                No products found
              </div>
            ) : (
              <ul className="flex flex-col gap-1 p-2">
                {results.map((product) => (
                  <li key={product.id}>
                    <Link
                      href={`/product/${product.slug}`}
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-green-950/5"
                    >
                      <span className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-green-950/5 bg-cream-100">
                        <ProductMedia
                          src={product.images[0]?.url}
                          fallbackPhoto={product.fallbackPhoto}
                          visual={product.visual}
                          alt={product.name}
                          sizes="40px"
                          pattern={false}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-green-950">
                          {product.name}
                        </span>
                        <span className="block text-[11px] text-brown-500">
                          {product.origin}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-green-950">
                        {formatBDT(product.variants[0].priceBDT)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

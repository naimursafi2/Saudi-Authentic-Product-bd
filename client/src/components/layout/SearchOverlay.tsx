"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { formatBDT } from "@/lib/utils";
import { useProductSearchSuggestions } from "@/hooks/useProductSearchSuggestions";
import { ProductMedia } from "@/components/ui/ProductMedia";

export { getSearchableText, rankProductMatches } from "@/lib/searchRanking";

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { results, isSearching } = useProductSearchSuggestions(query);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setQuery("");
        onClose();
      }
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleClose() {
    setQuery("");
    onClose();
  }

  function goToShop() {
    const nextQuery = query.trim();
    router.push(
      nextQuery ? `/shop?q=${encodeURIComponent(nextQuery)}` : "/shop",
    );
    handleClose();
  }

  return (
    <div className="fixed inset-0 z-[70] animate-fade-in">
      <button
        aria-label="Close search"
        className="absolute inset-0 cursor-pointer bg-green-950/15"
        onClick={handleClose}
      />
      <div className="relative mx-auto mt-3 w-[94%] max-w-md rounded-[22px] border border-green-950/10 bg-surface/95 shadow-[0_18px_48px_rgba(12,36,22,0.18)] backdrop-blur-[2px]">
        <div className="sticky top-0 z-10 rounded-t-[22px] border-b border-green-950/10 bg-surface/95 px-3 pb-2 pt-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              goToShop();
            }}
            className="flex items-center gap-2 rounded-2xl border border-green-950/10 bg-cream-100/80 px-3 py-2.5 shadow-inner shadow-green-950/5"
          >
            <Search size={17} className="shrink-0 text-brown-500" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dates, gift boxes..."
              aria-label="Search products"
              className="w-full bg-transparent text-sm text-green-950 placeholder:text-brown-500/70 focus:outline-none"
            />
            <button
              type="button"
              aria-label="Close search"
              onClick={handleClose}
              className="shrink-0 cursor-pointer rounded-full p-1 text-brown-500 transition-colors hover:bg-green-950/5 hover:text-green-950"
            >
              <X size={16} />
            </button>
          </form>
        </div>

        {query.trim() && (
          <div className="max-h-[54vh] min-h-[120px] overflow-y-auto px-2 pb-2 pt-2">
            {isSearching ? (
              <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-brown-500">
                <span className="inline-block size-3 animate-pulse rounded-full bg-gold-500" />
                Searching...
              </div>
            ) : results.length === 0 ? (
              <div className="px-4 py-5 text-center text-sm text-brown-500">
                No products found
              </div>
            ) : (
              <ul className="flex flex-col gap-1">
                {results.map((product) => (
                  <li key={product.id}>
                    <Link
                      href={`/product/${product.slug}`}
                      onClick={handleClose}
                      className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-green-950/5"
                    >
                      <span className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-green-950/5 bg-cream-100">
                        <ProductMedia
                          src={product.images[0]?.url}
                          fallbackPhoto={product.fallbackPhoto}
                          visual={product.visual}
                          alt={product.name}
                          sizes="48px"
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

            {results.length > 0 && (
              <button
                onClick={goToShop}
                className="mt-2 w-full cursor-pointer rounded-xl border border-green-950/10 bg-green-950/[0.02] px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-green-900 transition-colors hover:bg-green-950/5"
              >
                View all results
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

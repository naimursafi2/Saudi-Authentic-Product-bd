"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { listProducts } from "@/lib/api/products";
import { toProduct } from "@/lib/mappers";
import { formatBDT } from "@/lib/utils";
import { ProductMedia } from "@/components/ui/ProductMedia";
import type { Product } from "@/types/product";

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
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

  const [results, setResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const t = setTimeout(() => {
      listProducts({ q, limit: 5 })
        .then(({ data }) => {
          if (!cancelled) setResults(data.products.map(toProduct));
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  if (!open) return null;

  function handleClose() {
    setQuery("");
    onClose();
  }

  function goToShop() {
    router.push(`/shop?q=${encodeURIComponent(query.trim())}`);
    handleClose();
  }

  return (
    <div className="fixed inset-0 z-[70] animate-fade-in">
      <button
        aria-label="Close search"
        className="absolute inset-0 cursor-pointer bg-green-950/40 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative mx-auto mt-24 w-[92%] max-w-2xl rounded-lg bg-cream-100 shadow-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            goToShop();
          }}
          className="flex items-center gap-3 border-b border-green-900/10 px-5 py-4"
        >
          <Search size={18} className="shrink-0 text-brown-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for dates, gift boxes..."
            className="w-full bg-transparent text-base text-green-950 placeholder:text-brown-500/60 focus:outline-none"
          />
          <button
            type="button"
            aria-label="Close search"
            onClick={handleClose}
            className="shrink-0 cursor-pointer text-brown-500 hover:text-green-950"
          >
            <X size={18} />
          </button>
        </form>

        {query.trim() && (
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {isSearching ? (
              <p className="px-4 py-6 text-center text-sm text-brown-500">Searching...</p>
            ) : results.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-brown-500">
                No products found for &ldquo;{query}&rdquo;.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {results.map((product) => (
                  <li key={product.id}>
                    <Link
                      href={`/product/${product.slug}`}
                      onClick={handleClose}
                      className="flex items-center gap-3 rounded-md p-2 hover:bg-green-950/5"
                    >
                      <span className="relative size-12 shrink-0 overflow-hidden rounded">
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
                        <span className="block text-xs text-brown-500">{product.origin}</span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-green-950">
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
                className="mt-1 w-full cursor-pointer rounded-md p-3 text-center text-xs font-bold uppercase tracking-[0.1em] text-green-900 hover:bg-green-950/5"
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

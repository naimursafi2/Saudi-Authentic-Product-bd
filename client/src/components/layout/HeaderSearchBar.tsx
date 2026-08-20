"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The always-visible search field in the header's top row.
 *
 * Submitting navigates to `/shop?q=…`, which ShopPageClient already reads
 * and filters on — no new endpoint or search page was needed. The richer
 * live-results dropdown still exists as `SearchOverlay`, which the header
 * opens from the compact search icon on small screens where there is no
 * room for this bar.
 */
export function HeaderSearchBar({ className }: { className?: string }) {
  const [value, setValue] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className={cn(
        "flex items-center gap-2 rounded-full border border-green-950/12 bg-surface px-4 py-2 transition-colors focus-within:border-gold-500/60",
        className
      )}
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
  );
}

"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

  return (
    <nav className="flex items-center justify-center gap-2 pt-4" aria-label="Pagination">
      <button
        aria-label="Previous page"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="flex size-9 cursor-pointer items-center justify-center rounded border border-green-900/15 text-green-950 disabled:opacity-30"
      >
        <ChevronLeft size={16} />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          aria-current={p === page ? "page" : undefined}
          className={cn(
            "flex size-9 cursor-pointer items-center justify-center rounded text-sm font-semibold transition-colors",
            p === page
              ? "bg-brand-deep-2 text-white"
              : "text-green-950 hover:bg-green-950/5"
          )}
        >
          {p}
        </button>
      ))}
      <button
        aria-label="Next page"
        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        disabled={page === pageCount}
        className="flex size-9 cursor-pointer items-center justify-center rounded border border-green-900/15 text-green-950 disabled:opacity-30"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}

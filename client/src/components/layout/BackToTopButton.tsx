"use client";

import { ArrowUp } from "lucide-react";

/** Small premium touch in the footer's bottom bar — pure client-side scroll, no backend involved. */
export function BackToTopButton() {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-on-brand/25 text-on-brand/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-gold-500 hover:text-gold-500"
    >
      <ArrowUp size={14} />
    </button>
  );
}

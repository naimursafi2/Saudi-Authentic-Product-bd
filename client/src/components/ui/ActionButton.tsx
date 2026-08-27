import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ActionButtonTone = "info" | "danger" | "success" | "neutral";

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ActionButtonTone;
}

const TONE_CLASSES: Record<ActionButtonTone, string> = {
  // Hover jumps to the CONSTANT *-solid deep shade (with white text) rather
  // than the subtler *-soft-hover tint — a light-blue/light-red button that
  // only nudges a shade darker on hover reads as barely-there feedback: the
  // request was specifically for a hover state that's unmistakably a much
  // deeper, stronger version of the same color family, never gray/black.
  info: "bg-info-soft text-info hover:bg-info-solid hover:text-white",
  // Delete/Reject/Deny is intentionally its own bright, vivid red — not the
  // site's muted brick-red `danger` family used for error text/badges
  // elsewhere. A destructive action button needs to read as unmistakable
  // danger at a glance, so it's solid-filled + white text even at rest,
  // deepening further on hover. See `--color-delete`/`-hover` in globals.css.
  danger: "bg-delete text-white hover:bg-delete-hover",
  success: "bg-success-soft text-green-900 hover:bg-brand-deep-2 hover:text-white",
  neutral: "bg-cream-300 text-brown-600 hover:bg-cream-400",
};

/**
 * Shared row-action control for Edit/Delete/Update/Approve/Reject/etc.
 * across the admin portal — an always-visible text label (never an
 * icon-only button that only reveals its meaning on hover), a light
 * background at rest that darkens on hover, and consistent padding/radius/
 * transition. `tone` picks the color family; text and background always
 * move together so nothing is ever bare colored text with no background.
 * Padding is sized for a comfortable touch target on mobile/tablet without
 * looking oversized on desktop.
 */
export function ActionButton({ tone = "neutral", className, children, ...props }: ActionButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors duration-200 ease-in-out disabled:cursor-not-allowed disabled:opacity-50",
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Wraps a row's ActionButtons with responsive spacing: stacked vertically
 * with a comfortable gap on mobile/tablet (so Edit/Delete never look stuck
 * together), inline with wrapping on larger screens. Right-aligns to match
 * the `text-right` action column it's almost always used inside.
 */
export function ActionButtonGroup({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-col items-end gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2",
        className
      )}
    >
      {children}
    </div>
  );
}

import { ButtonHTMLAttributes, forwardRef } from "react";
import Link, { LinkProps } from "next/link";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "gold"
  | "outline"
  | "ghost"
  | "danger"
  | "cart"
  | "buyNow"
  | "whatsapp"
  | "call"
  | "addToCart";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "action";

/**
 * Shape (radius/casing/transition) lives per-variant rather than in the
 * shared base below, because the four purchase-action variants
 * (cart/buyNow/whatsapp/call — see globals.css's `--color-action-*` tokens)
 * deliberately diverge from the rest: a larger radius, normal case instead
 * of uppercase, and a slower 200ms transition. Two declarations for the
 * same CSS property (e.g. base `rounded` + a variant's `rounded-lg`) both
 * landing on one element is unreliable to override — Tailwind resolves that
 * by generated-stylesheet order, not by where the class appears in the
 * string — so each variant owns its shape outright instead.
 */
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "rounded uppercase tracking-[0.05em] transition-colors duration-150 bg-brand-deep-2 text-white hover:bg-brand-deep shadow-[0_1px_1px_rgba(0,0,0,0.05)]",
  gold: "rounded uppercase tracking-[0.05em] transition-colors duration-150 bg-gold-500 text-on-gold hover:bg-gold-600 shadow-[0_4px_7px_rgba(61,43,31,0.15)]",
  outline:
    "rounded uppercase tracking-[0.05em] transition-colors duration-150 border border-green-900/30 text-green-950 hover:bg-green-950/5 bg-transparent",
  ghost:
    "rounded uppercase tracking-[0.05em] transition-colors duration-150 text-green-950 hover:bg-black/5 bg-transparent",
  // Destructive confirmations (ConfirmDialogContext's "danger" tone) — a
  // deliberately bright, vivid red (`--color-delete`/`-hover`, CONSTANT
  // across themes, always white text), not the site's muted brick-red
  // `danger-solid` used for badges/banners elsewhere. A destructive
  // confirmation needs to read as unmistakable danger at a glance.
  danger:
    "rounded uppercase tracking-[0.05em] transition-colors duration-150 bg-delete text-white hover:bg-delete-hover",
  // The product page's four purchase-action buttons — see the CONSTANT
  // `--color-action-*` tokens' comment in globals.css for why these carry a
  // fixed color regardless of the light/dark toggle.
  cart: "rounded-lg normal-case tracking-normal transition-[background-color,box-shadow] duration-200 ease-in-out bg-action-cart text-white hover:bg-action-cart-hover shadow-[0_2px_8px_rgba(245,130,32,0.25)] hover:shadow-[0_4px_14px_rgba(245,130,32,0.35)]",
  buyNow:
    "rounded-lg normal-case tracking-normal transition-colors duration-200 ease-in-out bg-action-buynow text-white hover:bg-action-buynow-hover",
  whatsapp:
    "rounded-lg normal-case tracking-normal transition-colors duration-200 ease-in-out bg-action-whatsapp text-white hover:bg-action-whatsapp-hover",
  call: "rounded-lg normal-case tracking-normal transition-colors duration-200 ease-in-out bg-action-call text-white hover:bg-action-call-hover",
  /**
   * Product-card grid's "Add to Cart" button — a liquid/water-fill hover
   * effect rather than a flat color swap. `relative isolate overflow-hidden`
   * on the button clips the fill layer to its own (pill) shape and gives it
   * a local stacking context; `before:` is the liquid itself: full width,
   * anchored to the bottom via `[transform-origin:bottom]`, scaled to 0
   * height at rest and grown to full height on hover — CSS transforms don't
   * affect layout/box-model, so the `border-radius` wave shape (a shallow
   * dome across the whole top edge, not just rounded corners) stays crisp
   * as it grows. `-z-10` keeps it behind the button's actual text/icon
   * content, which — being plain, non-positioned children — would otherwise
   * sit BEHIND a positioned pseudo-element by default. The reverse
   * (scale-y-100 → scale-y-0) plays automatically on mouse-leave via the
   * same transition, so the liquid recedes smoothly rather than vanishing.
   */
  addToCart:
    "relative isolate overflow-hidden rounded-full uppercase tracking-[0.05em] text-white shadow-sm bg-cart-soft " +
    "transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-px hover:shadow-[0_6px_14px_rgba(2,45,29,0.28)] active:translate-y-0 " +
    "before:content-[''] before:absolute before:inset-x-0 before:bottom-0 before:-z-10 before:h-full before:bg-cart-liquid " +
    "before:[transform-origin:bottom] before:scale-y-0 before:rounded-[50%_50%_0_0/10px_10px_0_0] " +
    "before:transition-transform before:duration-300 before:ease-out hover:before:scale-y-100",
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: "h-8 px-3.5 text-[11px]",
  sm: "h-9 px-4 text-xs",
  md: "h-11 px-6 text-sm",
  lg: "h-14 px-10 text-base",
  /** The product page's four purchase-action buttons — 44px tall (inside
   * the requested 42–46px), 16px horizontal padding. */
  action: "h-11 px-4 text-sm",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string
) {
  return cn(
    "inline-flex cursor-pointer items-center justify-center gap-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button ref={ref} className={buttonClasses(variant, size, className)} {...props} />
    );
  }
);
Button.displayName = "Button";

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  /** Next's LinkProps doesn't carry plain anchor attributes; this one is
   * needed to pull an off-screen carousel slide's CTA out of the tab order. */
  tabIndex?: number;
}

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <Link ref={ref} className={buttonClasses(variant, size, className)} {...props} />
    );
  }
);
ButtonLink.displayName = "ButtonLink";

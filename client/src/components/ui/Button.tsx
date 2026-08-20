import { ButtonHTMLAttributes, forwardRef } from "react";
import Link, { LinkProps } from "next/link";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "gold" | "outline" | "ghost";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-green-900 text-white hover:bg-green-950 shadow-[0_1px_1px_rgba(0,0,0,0.05)]",
  gold:
    "bg-gold-500 text-green-950 hover:bg-gold-600 shadow-[0_4px_7px_rgba(61,43,31,0.15)]",
  outline:
    "border border-green-900/30 text-green-950 hover:bg-green-950/5 bg-transparent",
  ghost: "text-green-950 hover:bg-black/5 bg-transparent",
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: "h-8 px-3.5 text-[11px]",
  sm: "h-9 px-4 text-xs",
  md: "h-11 px-6 text-sm",
  lg: "h-14 px-10 text-base",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string
) {
  return cn(
    "inline-flex cursor-pointer items-center justify-center gap-2 rounded font-semibold uppercase tracking-[0.05em] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
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
}

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <Link ref={ref} className={buttonClasses(variant, size, className)} {...props} />
    );
  }
);
ButtonLink.displayName = "ButtonLink";

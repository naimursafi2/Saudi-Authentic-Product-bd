import { Droplet, Gift, Leaf, Nut, Package, Sparkles, Watch } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductVisual as ProductVisualSpec, VisualIconName } from "@/types/product";

/**
 * Self-contained decorative product visual used in place of photography.
 * Renders a warm, on-brand gradient with a centered glyph so the storefront
 * never depends on external image hosts. Swap the implementation for real
 * <Image> photography later without touching call sites — every product
 * card / gallery just passes a `ProductVisualSpec`.
 */

const ICONS: Record<VisualIconName, typeof Package> = {
  Package,
  Gift,
  Droplet,
  Watch,
  Leaf,
  Sparkles,
  Nut,
};

/**
 * The five decorative tones, as `visual-*` tokens rather than raw hex.
 *
 * These tokens are deliberately CONSTANT across light and dark (defined once
 * in globals.css, never overridden under `[data-theme="dark"]`): this
 * gradient stands in for a product photograph, and a photograph doesn't
 * recolour with the theme. Tokenising them is about getting hex literals out
 * of components, not about making the artwork themeable — so don't "fix"
 * this by pointing them at the inverting `gold-*` / `brown-*` ramps.
 */
const GRADIENTS: Record<ProductVisualSpec["tone"], string> = {
  green: "from-visual-green-1 via-visual-green-2 to-visual-green-3",
  cream: "from-visual-cream-1 via-visual-cream-2 to-visual-cream-3",
  gold: "from-visual-gold-1 via-visual-gold-2 to-visual-gold-3",
  brown: "from-visual-brown-1 via-visual-brown-2 to-visual-brown-3",
  plum: "from-visual-plum-1 via-visual-plum-2 to-visual-plum-3",
};

interface ProductVisualProps extends ProductVisualSpec {
  className?: string;
  iconClassName?: string;
  pattern?: boolean;
  variant?: number;
}

export function ProductVisual({
  icon,
  tone,
  className,
  iconClassName,
  pattern = true,
  variant = 0,
}: ProductVisualProps) {
  const Icon = ICONS[icon];
  return (
    <div
      className={cn(
        "relative flex size-full items-center justify-center overflow-hidden bg-gradient-to-br",
        GRADIENTS[tone],
        className
      )}
    >
      {pattern && (
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.55) 0px, transparent 40%), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.35) 0px, transparent 45%)",
            transform: variant ? `rotate(${variant * 35}deg) scale(1.2)` : undefined,
          }}
        />
      )}
      <Icon
        className={cn(
          "relative drop-shadow-sm",
          tone === "green" ? "text-on-brand/90" : "text-black/25",
          iconClassName
        )}
        strokeWidth={1.1}
        style={variant ? { transform: `scale(${1 + variant * 0.06}) rotate(${variant * 4}deg)` } : undefined}
      />
    </div>
  );
}

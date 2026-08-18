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

const GRADIENTS: Record<ProductVisualSpec["tone"], string> = {
  green: "from-[#1b4332] via-[#0f2a20] to-[#012d1d]",
  cream: "from-[#f5efe1] via-[#eadfc4] to-[#d9c68f]",
  gold: "from-[#e9cd7a] via-[#d4af37] to-[#a9822a]",
  brown: "from-[#c9a789] via-[#a5826a] to-[#705a4c]",
  plum: "from-[#e7c9c9] via-[#c99a94] to-[#8a5a52]",
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
          tone === "green" ? "text-cream-100/90" : "text-black/25",
          iconClassName
        )}
        strokeWidth={1.1}
        style={variant ? { transform: `scale(${1 + variant * 0.06}) rotate(${variant * 4}deg)` } : undefined}
      />
    </div>
  );
}

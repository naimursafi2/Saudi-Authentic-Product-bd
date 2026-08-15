"use client";

import Link from "next/link";
import { Heart, ShoppingCart } from "lucide-react";
import type { Product } from "@/types/product";
import { formatBDT, cn } from "@/lib/utils";
import { ProductMedia } from "./ProductMedia";
import { StarRating } from "./StarRating";
import { Button } from "./Button";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";

interface ProductCardProps {
  product: Product;
  className?: string;
}

const badgeClasses: Record<NonNullable<Product["badge"]>, string> = {
  Authentic: "bg-[#fcf8ee] text-[#735c00]",
  "Best Seller": "bg-[#fcf8ee] text-[#735c00]",
  New: "bg-[#e9f3ee] text-green-900",
  Limited: "bg-[#fbeceb] text-[#8a4a3f]",
};

export function ProductCard({ product, className }: ProductCardProps) {
  const { addItem } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const defaultVariant = product.variants[0];
  const wishlisted = isWishlisted(product.id);
  const discountPercent =
    defaultVariant.compareAtPriceBDT && defaultVariant.compareAtPriceBDT > defaultVariant.priceBDT
      ? Math.round(
          ((defaultVariant.compareAtPriceBDT - defaultVariant.priceBDT) / defaultVariant.compareAtPriceBDT) * 100
        )
      : null;

  return (
    <div
      className={cn(
        "group flex flex-1 flex-col overflow-hidden rounded-lg border border-gold-500/30 bg-cream-100 shadow-[0_4px_15px_rgba(61,43,31,0.05)] transition-shadow hover:shadow-[0_8px_24px_rgba(61,43,31,0.1)]",
        className
      )}
    >
      <Link
        href={`/product/${product.slug}`}
        className="relative block aspect-[4/3] w-full overflow-hidden bg-cream-400"
      >
        <ProductMedia
          src={product.images[0]?.url}
          fallbackPhoto={product.fallbackPhoto}
          visual={product.visual}
          alt={product.name}
          sizes="(min-width: 1280px) 380px, (min-width: 640px) 50vw, 100vw"
          className="transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1">
          {product.badge && (
            <span
              className={cn(
                "rounded-full border border-black/5 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em]",
                badgeClasses[product.badge]
              )}
            >
              {product.badge}
            </span>
          )}
          {discountPercent != null && (
            <span className="rounded-full border border-black/5 bg-[#8a4a3f] px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
              Save {discountPercent}%
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          onClick={(e) => {
            e.preventDefault();
            toggleWishlist(product.id);
          }}
          className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full bg-white/85 text-brown-500 backdrop-blur transition-colors hover:text-[#8a4a3f]"
        >
          <Heart size={14} className={wishlisted ? "fill-[#8a4a3f] text-[#8a4a3f]" : ""} />
        </button>
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <Link href={`/product/${product.slug}`}>
          <h3 className="font-sans text-base font-semibold leading-snug text-green-950 hover:text-green-900">
            {product.name}
          </h3>
        </Link>
        <p className="line-clamp-2 text-sm leading-snug text-brown-500">{product.tagline}</p>
        {product.ratingCount > 0 && <StarRating rating={product.ratingAverage} size={12} />}
        <div className="mt-auto flex flex-col gap-2 pt-2">
          <span className="flex items-baseline gap-2">
            <span className="text-lg font-semibold leading-none text-green-950">
              {formatBDT(defaultVariant.priceBDT)}
            </span>
            {defaultVariant.compareAtPriceBDT && defaultVariant.compareAtPriceBDT > defaultVariant.priceBDT && (
              <span className="text-xs leading-none text-brown-500/60 line-through">
                {formatBDT(defaultVariant.compareAtPriceBDT)}
              </span>
            )}
          </span>
          <Button
            type="button"
            variant="primary"
            size="xs"
            aria-label={`Add ${product.name} to cart`}
            onClick={() => addItem(product.id, defaultVariant.id, 1)}
            className="w-full gap-2 rounded-full shadow-sm transition-all duration-300 hover:shadow-[0_6px_16px_rgba(1,45,29,0.25)]"
          >
            <ShoppingCart size={14} />
            Add to Cart
          </Button>
        </div>
      </div>
    </div>
  );
}

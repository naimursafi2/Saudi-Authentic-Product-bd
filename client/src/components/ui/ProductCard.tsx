"use client";

import Link from "next/link";
import { Heart, Scale, ShoppingCart } from "lucide-react";
import type { Product } from "@/types/product";
import { formatBDT, cn } from "@/lib/utils";
import { ProductMedia } from "./ProductMedia";
import { StarRating } from "./StarRating";
import { Button } from "./Button";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { useCompare } from "@/context/CompareContext";
import { isStockOut, firstAvailableVariant } from "@/lib/stock";

interface ProductCardProps {
  product: Product;
  className?: string;
  /** Only shop-style listing grids opt in — a card everywhere else (related/recently-viewed rails, homepage carousel) stays as-is. */
  showCompareToggle?: boolean;
}

const badgeClasses: Record<NonNullable<Product["badge"]>, string> = {
  Authentic: "bg-gold-soft text-gold-700",
  "Best Seller": "bg-gold-soft text-gold-700",
  New: "bg-success-soft text-green-900",
  Limited: "bg-danger-soft text-danger",
};

export function ProductCard({ product, className, showCompareToggle }: ProductCardProps) {
  const { addItem } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { isComparing, toggleCompare } = useCompare();
  const comparing = isComparing(product.id);
  const defaultVariant = product.variants[0];
  const wishlisted = isWishlisted(product.id);
  const stockOut = isStockOut(product);
  // Quick-add targets the first variant that can actually ship, so a card
  // whose default size sold out still adds something real to the cart.
  const addableVariant = firstAvailableVariant(product);
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
          fit="cover"
          sizes="(min-width: 1280px) 300px, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
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
          {discountPercent != null && !stockOut && (
            <span className="rounded-full border border-black/5 bg-danger-solid px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
              Save {discountPercent}%
            </span>
          )}
          {stockOut && (
            <span className="rounded-full border border-black/5 bg-brown-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
              Stock Out
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
          className="absolute right-3 top-3 flex size-7 cursor-pointer items-center justify-center rounded-full bg-white/85 text-brown-500 backdrop-blur transition-colors hover:text-danger"
        >
          <Heart size={14} className={wishlisted ? "fill-danger text-danger" : ""} />
        </button>
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <Link href={`/product/${product.slug}`}>
          <h3 className="font-sans text-base font-semibold leading-snug text-green-950 hover:text-green-900">
            {product.name}
          </h3>
        </Link>
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
            variant="addToCart"
            size="xs"
            disabled={!addableVariant}
            aria-label={
              addableVariant ? `Add ${product.name} to cart` : `${product.name} is out of stock`
            }
            onClick={() => addableVariant && addItem(product.id, addableVariant.id, 1)}
            className="w-full gap-2"
          >
            <ShoppingCart size={14} />
            {addableVariant ? "Add to Cart" : "Stock Out"}
          </Button>
          {showCompareToggle && (
            <button
              type="button"
              onClick={() => toggleCompare(product.id)}
              className={cn(
                "flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors",
                comparing
                  ? "border-green-900 bg-green-950/5 text-green-950"
                  : "border-brown-600/15 text-brown-500 hover:border-green-900/30 hover:text-green-950"
              )}
            >
              <Scale size={12} />
              {comparing ? "Added to Compare" : "Add to Compare"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

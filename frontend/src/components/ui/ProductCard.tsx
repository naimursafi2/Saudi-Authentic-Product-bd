"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingCart } from "lucide-react";
import type { Product } from "@/types/product";
import { formatBDT, cn } from "@/lib/utils";
import { ProductVisual } from "./ProductVisual";
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

  return (
    <div
      className={cn(
        "group flex flex-1 flex-col overflow-hidden rounded-lg border border-gold-500/30 bg-cream-100 shadow-[0_4px_15px_rgba(61,43,31,0.05)] transition-shadow hover:shadow-[0_8px_24px_rgba(61,43,31,0.1)]",
        className
      )}
    >
      <Link
        href={`/product/${product.slug}`}
        className="relative block aspect-[4/5] w-full overflow-hidden bg-cream-400"
      >
        {product.images.length > 0 ? (
          <Image
            src={product.images[0].url}
            alt={product.name}
            fill
            sizes="(min-width: 1280px) 380px, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <ProductVisual
            {...product.visual}
            className="transition-transform duration-500 group-hover:scale-105"
          />
        )}
        {product.badge && (
          <span
            className={cn(
              "absolute left-4 top-[17px] rounded-full border border-black/5 px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em]",
              badgeClasses[product.badge]
            )}
          >
            {product.badge}
          </span>
        )}
        <button
          type="button"
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          onClick={(e) => {
            e.preventDefault();
            toggleWishlist(product.id);
          }}
          className="absolute right-4 top-[17px] flex size-8 items-center justify-center rounded-full bg-white/85 text-brown-500 backdrop-blur transition-colors hover:text-[#8a4a3f]"
        >
          <Heart size={15} className={wishlisted ? "fill-[#8a4a3f] text-[#8a4a3f]" : ""} />
        </button>
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-6">
        <Link href={`/product/${product.slug}`}>
          <h3 className="font-sans text-xl font-semibold text-green-950 hover:text-green-900">
            {product.name}
          </h3>
        </Link>
        <p className="line-clamp-2 text-base text-brown-500">{product.tagline}</p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-xl font-semibold text-green-950">
            {formatBDT(defaultVariant.priceBDT)}
          </span>
          <button
            type="button"
            aria-label={`Add ${product.name} to cart`}
            onClick={() => addItem(product.id, defaultVariant.id, 1)}
            className="flex size-10 items-center justify-center rounded-full bg-green-900 text-white shadow-[0_1px_1px_rgba(0,0,0,0.05)] transition-transform hover:scale-105 hover:bg-green-950"
          >
            <ShoppingCart size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

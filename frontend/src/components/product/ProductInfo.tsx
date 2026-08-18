"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Heart, ShoppingCart, Truck, Zap } from "lucide-react";
import type { Product } from "@/types/product";
import { formatBDT, cn } from "@/lib/utils";
import { StarRating } from "@/components/ui/StarRating";
import { QuantityInput } from "@/components/ui/QuantityInput";
import { Button } from "@/components/ui/Button";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";

export function ProductInfo({ product }: { product: Product }) {
  const [variantId, setVariantId] = useState(product.variants[0].id);
  const [quantity, setQuantity] = useState(1);
  const { addItem, closeDrawer } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const router = useRouter();
  const wishlisted = isWishlisted(product.id);

  const variant = useMemo(
    () => product.variants.find((v) => v.id === variantId) ?? product.variants[0],
    [product.variants, variantId]
  );

  function handleAddToCart() {
    addItem(product.id, variant.id, quantity);
  }

  function handleBuyNow() {
    addItem(product.id, variant.id, quantity);
    closeDrawer();
    router.push("/checkout");
  }

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-brown-500">
        <Link href="/" className="hover:text-green-950">
          Home
        </Link>
        <ChevronRight size={12} />
        <Link href={`/shop?category=${product.categories[0]?.slug ?? ""}`} className="hover:text-green-950">
          {product.categories[0]?.name ?? "Shop"}
        </Link>
        <ChevronRight size={12} />
        <span className="truncate text-green-950/70">{product.name}</span>
      </nav>

      <div className="flex flex-col gap-3">
        <h1 className="font-serif text-3xl font-semibold leading-tight tracking-[-0.02em] text-green-950 sm:text-4xl">
          {product.name}
        </h1>
        <StarRating
          rating={product.ratingAverage}
          showValue
          reviewCount={product.ratingCount}
        />
      </div>

      <div className="flex items-center gap-3 border-b border-green-900/10 pb-6">
        <span className="text-3xl font-semibold text-green-950">
          {formatBDT(variant.priceBDT)}
        </span>
        {variant.compareAtPriceBDT && (
          <span className="text-lg text-brown-500/60 line-through">
            {formatBDT(variant.compareAtPriceBDT)}
          </span>
        )}
      </div>

      {product.variants.length > 1 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-brown-600">
            Select Weight
          </p>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v) => (
              <button
                key={v.id}
                onClick={() => setVariantId(v.id)}
                className={cn(
                  "rounded border px-5 py-2 text-sm font-semibold transition-colors",
                  v.id === variantId
                    ? "border-gold-500 bg-gold-500 text-green-950"
                    : "border-green-900/20 text-green-950 hover:border-green-900/40"
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-brown-600">
          Quantity
        </p>
        <QuantityInput value={quantity} onChange={setQuantity} max={Math.max(1, variant.stock)} />
        {variant.stock === 0 && (
          <p className="mt-2 text-xs font-semibold text-[#8a4a3f]">Out of stock</p>
        )}
        {variant.stock > 0 && variant.stock <= 5 && (
          <p className="mt-2 text-xs font-semibold text-brown-600">Only {variant.stock} left</p>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          onClick={handleAddToCart}
          disabled={variant.stock === 0}
        >
          <ShoppingCart size={16} /> Add to Cart
        </Button>
        <Button
          variant="gold"
          size="lg"
          className="flex-1"
          onClick={handleBuyNow}
          disabled={variant.stock === 0}
        >
          <Zap size={16} /> Buy Now
        </Button>
        <button
          type="button"
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          onClick={() => toggleWishlist(product.id)}
          className={cn(
            "flex size-12 shrink-0 items-center justify-center self-center rounded border border-green-900/20 text-brown-500 transition-colors hover:border-[#8a4a3f]/40 hover:text-[#8a4a3f] sm:self-auto",
            wishlisted && "border-[#8a4a3f]/40 text-[#8a4a3f]"
          )}
        >
          <Heart size={18} className={wishlisted ? "fill-[#8a4a3f]" : ""} />
        </button>
      </div>

      <p className="flex items-center gap-2 text-xs text-brown-500">
        <Truck size={14} /> Free delivery across Bangladesh on orders over{" "}
        {formatBDT(5000)}.
      </p>
    </div>
  );
}

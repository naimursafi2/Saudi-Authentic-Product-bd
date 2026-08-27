"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Heart, Loader2, Phone, ShoppingCart, Truck, Zap } from "lucide-react";
import type { Product } from "@/types/product";
import { formatBDT, cn } from "@/lib/utils";
import { toTelHref, toWhatsAppHref } from "@/lib/phone";
import { StarRating } from "@/components/ui/StarRating";
import { ProductAlertButtons } from "@/components/product/ProductAlertButtons";
import { QuantityInput } from "@/components/ui/QuantityInput";
import { Button, buttonClasses } from "@/components/ui/Button";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { useSiteSettings } from "@/lib/hooks/useSiteSettings";

/** How long the "Adding..." / "Added" transient states each stay visible. */
const ADD_TO_CART_PENDING_MS = 350;
const ADD_TO_CART_CONFIRM_MS = 1400;

export function ProductInfo({ product }: { product: Product }) {
  const [variantId, setVariantId] = useState(product.variants[0].id);
  const [quantity, setQuantity] = useState(1);
  const [cartState, setCartState] = useState<"idle" | "adding" | "added">("idle");
  const [isBuyNowLoading, setIsBuyNowLoading] = useState(false);
  const cartTimeouts = useRef<number[]>([]);
  const { addItem, closeDrawer } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { settings } = useSiteSettings();
  const router = useRouter();
  const wishlisted = isWishlisted(product.id);
  const contactPhone = settings?.contactPhone?.trim();

  const variant = useMemo(
    () => product.variants.find((v) => v.id === variantId) ?? product.variants[0],
    [product.variants, variantId]
  );
  const outOfStock = variant.stock === 0;

  // Cart persistence itself is synchronous (see CartContext — it's
  // localStorage, not a network call), so this transient sequence is purely
  // the "Adding... -> Added" feedback the button asked for; the `cartState
  // !== "idle"` guard is what stops a rapid double-click from queuing the
  // add twice.
  function handleAddToCart() {
    if (cartState !== "idle" || outOfStock) return;
    setCartState("adding");
    const t1 = window.setTimeout(() => {
      addItem(product.id, variant.id, quantity);
      setCartState("added");
      const t2 = window.setTimeout(() => setCartState("idle"), ADD_TO_CART_CONFIRM_MS);
      cartTimeouts.current.push(t2);
    }, ADD_TO_CART_PENDING_MS);
    cartTimeouts.current.push(t1);
  }

  function handleBuyNow() {
    if (isBuyNowLoading || outOfStock) return;
    setIsBuyNowLoading(true);
    addItem(product.id, variant.id, quantity);
    closeDrawer();
    router.push("/checkout");
  }

  const productUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/product/${product.slug}`
      : `/product/${product.slug}`;
  const whatsappMessage = [
    `Hi, I'd like to order:`,
    product.name,
    `Quantity: ${quantity}`,
    `Price: ${formatBDT(variant.priceBDT)}`,
    productUrl,
  ].join("\n");

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

      <div className="flex flex-wrap items-center gap-3 border-b border-green-900/10 pb-6">
        <span className="text-3xl font-semibold text-green-950">
          {formatBDT(variant.priceBDT)}
        </span>
        {variant.compareAtPriceBDT && (
          <span className="text-lg text-brown-500/60 line-through">
            {formatBDT(variant.compareAtPriceBDT)}
          </span>
        )}
        {variant.stock === 0 && (
          <span className="rounded-full bg-brown-600 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white">
            Stock Out
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
                  "cursor-pointer rounded border px-5 py-2 text-sm font-semibold transition-colors",
                  v.id === variantId
                    ? "border-gold-500 bg-gold-500 text-on-gold"
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
        {variant.stock === 0 ? (
          <p className="mt-2 text-xs font-semibold text-danger">
            This size is out of stock and can&apos;t be ordered right now.
          </p>
        ) : (
          <p className="mt-2 text-xs font-semibold text-brown-600">
            {variant.stock <= 5 ? `Only ${variant.stock} left` : `${variant.stock} in stock`}
          </p>
        )}
      </div>

      <ProductAlertButtons productId={product.id} variantId={variant.id} outOfStock={outOfStock} />

      {/* Four purchase-action buttons in a 2x2 grid (same at every
          breakpoint — two narrow buttons per row reads fine even on small
          phones, so this deliberately doesn't collapse to a single column).
          The wishlist toggle sits beside the grid rather than inside it —
          it isn't one of the four requested actions, so it kept its
          previous position rather than being folded into the grid. */}
      <div className="flex items-stretch gap-2.5 sm:gap-3">
        <div className="grid flex-1 grid-cols-2 gap-2 sm:gap-2.5">
          <Button
            variant="cart"
            size="action"
            onClick={handleAddToCart}
            disabled={outOfStock || cartState !== "idle"}
          >
            {cartState === "adding" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : cartState === "added" ? (
              <Check size={16} />
            ) : (
              <ShoppingCart size={16} />
            )}
            {cartState === "adding" ? "Adding..." : cartState === "added" ? "Added" : "Add to Cart"}
          </Button>
          <Button
            variant="buyNow"
            size="action"
            onClick={handleBuyNow}
            disabled={outOfStock || isBuyNowLoading}
          >
            {isBuyNowLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {isBuyNowLoading ? "Redirecting..." : "Buy Now"}
          </Button>
          {contactPhone ? (
            <a
              href={toWhatsAppHref(contactPhone, whatsappMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses("whatsapp", "action")}
            >
              <SocialIcon platform="whatsapp" size={16} /> Order on WhatsApp
            </a>
          ) : (
            <Button variant="whatsapp" size="action" disabled title="WhatsApp number not configured">
              <SocialIcon platform="whatsapp" size={16} /> Order on WhatsApp
            </Button>
          )}
          {contactPhone ? (
            <a href={toTelHref(contactPhone)} className={buttonClasses("call", "action")}>
              <Phone size={16} /> Call for Order
            </a>
          ) : (
            <Button variant="call" size="action" disabled title="Phone number not configured">
              <Phone size={16} /> Call for Order
            </Button>
          )}
        </div>
        <button
          type="button"
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          onClick={() => toggleWishlist(product.id)}
          className={cn(
            "flex w-12 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-green-900/20 text-brown-500 transition-colors duration-200 ease-in-out hover:border-danger/40 hover:text-danger",
            wishlisted && "border-danger/40 text-danger"
          )}
        >
          <Heart size={18} className={wishlisted ? "fill-danger" : ""} />
        </button>
      </div>

      <p className="flex items-center gap-2 text-xs text-brown-500">
        <Truck size={14} /> Free delivery across Bangladesh on orders over{" "}
        {formatBDT(5000)}.
      </p>
    </div>
  );
}

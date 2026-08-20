"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatBDT } from "@/lib/utils";
import { ProductMedia } from "@/components/ui/ProductMedia";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

export default function CartPage() {
  const { items, lines, subtotal, isLoading, updateQuantity, removeItem } = useCart();

  if (isLoading && lines.length > 0) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-10 sm:px-10 lg:px-16 lg:py-14">
        <div className="mb-10">
          <SectionHeading title="Your Cart" align="left" dividerWidth={64} />
        </div>
        <div className="flex flex-col gap-4">
          {lines.map((line) => (
            <div
              key={`${line.productId}-${line.variantId}`}
              className="h-28 w-full animate-pulse rounded-lg bg-cream-300"
            />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-6 py-24 text-center">
        <ShoppingBag size={40} className="text-brown-500/50" />
        <h1 className="font-serif text-3xl text-green-950">Your cart is empty</h1>
        <p className="max-w-sm text-sm text-brown-500">
          Looks like you haven&apos;t added any authentic Saudi products yet.
        </p>
        <ButtonLink href="/shop" variant="primary" size="md" className="mt-2">
          Continue Shopping
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10 sm:px-10 lg:px-16 lg:py-14">
      <div className="mb-10">
        <SectionHeading title="Your Cart" align="left" dividerWidth={64} />
      </div>
      <div className="flex flex-col gap-10 lg:flex-row">
        <ul className="flex flex-1 flex-col divide-y divide-green-900/10 rounded-lg border border-green-900/10 bg-cream-100">
          {items.map((item) => (
            <li key={`${item.product.id}-${item.variant.id}`} className="flex gap-4 p-5 sm:gap-6 sm:p-6">
              <Link
                href={`/product/${item.product.slug}`}
                className="relative size-24 shrink-0 overflow-hidden rounded sm:size-28"
              >
                <ProductMedia
                  src={item.product.images[0]?.url}
                  fallbackPhoto={item.product.fallbackPhoto}
                  visual={item.product.visual}
                  alt={item.product.name}
                  sizes="112px"
                  pattern={false}
                />
              </Link>
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/product/${item.product.slug}`}
                      className="text-base font-semibold text-green-950 hover:text-green-900 sm:text-lg"
                    >
                      {item.product.name}
                    </Link>
                    <p className="text-xs text-brown-500 sm:text-sm">{item.variant.label}</p>
                  </div>
                  <button
                    aria-label="Remove item"
                    onClick={() => removeItem(item.product.id, item.variant.id)}
                    className="shrink-0 cursor-pointer text-brown-500/70 hover:text-[#8a4a3f]"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 rounded border border-green-900/20">
                    <button
                      aria-label="Decrease quantity"
                      onClick={() =>
                        updateQuantity(item.product.id, item.variant.id, item.quantity - 1)
                      }
                      className="flex size-8 cursor-pointer items-center justify-center text-green-950 hover:bg-green-950/5"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-5 text-center text-sm font-semibold text-green-950">
                      {item.quantity}
                    </span>
                    <button
                      aria-label="Increase quantity"
                      onClick={() =>
                        updateQuantity(item.product.id, item.variant.id, item.quantity + 1)
                      }
                      className="flex size-8 cursor-pointer items-center justify-center text-green-950 hover:bg-green-950/5"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <span className="text-base font-semibold text-green-950">
                    {formatBDT(item.lineTotal)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="flex h-fit w-full flex-col gap-5 rounded-lg border border-green-900/10 bg-cream-300 p-6 lg:w-[340px] lg:shrink-0">
          <h2 className="font-serif text-xl text-green-950">Order Summary</h2>
          <div className="flex items-center justify-between text-sm text-brown-600">
            <span>Subtotal</span>
            <span className="font-semibold text-green-950">{formatBDT(subtotal)}</span>
          </div>
          <p className="text-xs text-brown-500">
            Shipping and payment options are calculated at checkout.
          </p>
          <div className="h-px bg-green-900/10" />
          <div className="flex items-center justify-between">
            <span className="font-semibold text-green-950">Estimated Total</span>
            <span className="text-xl font-semibold text-green-950">{formatBDT(subtotal)}</span>
          </div>
          <ButtonLink href="/checkout" variant="gold" size="lg" className="w-full">
            Proceed to Checkout
          </ButtonLink>
          <ButtonLink href="/shop" variant="outline" size="md" className="w-full">
            Continue Shopping
          </ButtonLink>
        </aside>
      </div>
    </div>
  );
}

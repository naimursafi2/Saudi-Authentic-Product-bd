"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatBDT } from "@/lib/utils";
import { ProductMedia } from "@/components/ui/ProductMedia";
import { ButtonLink } from "@/components/ui/Button";

export function CartDrawer() {
  const { items, lines, subtotal, isDrawerOpen, isLoading, closeDrawer, updateQuantity, removeItem } =
    useCart();

  if (!isDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        aria-label="Close cart"
        className="absolute inset-0 cursor-pointer animate-fade-in bg-green-950/40 backdrop-blur-sm"
        onClick={closeDrawer}
      />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md animate-slide-in-right flex-col bg-cream-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-green-900/10 px-6 py-5">
          <h2 className="font-serif text-2xl text-green-950">Your Cart</h2>
          <button
            aria-label="Close cart"
            onClick={closeDrawer}
            className="cursor-pointer text-brown-500 hover:text-green-950"
          >
            <X size={20} />
          </button>
        </div>

        {isLoading && lines.length > 0 ? (
          <div className="flex-1 space-y-4 px-6 py-4">
            {lines.map((line) => (
              <div
                key={`${line.productId}-${line.variantId}`}
                className="h-24 w-full animate-pulse rounded bg-cream-300"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingBag size={36} className="text-brown-500/50" />
            <p className="text-sm text-brown-500">Your cart is empty.</p>
            <ButtonLink variant="primary" size="sm" onClick={closeDrawer} href="/shop">
              Continue Shopping
            </ButtonLink>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto px-6 py-4">
              {items.map((item) => (
                <li
                  key={`${item.product.id}-${item.variant.id}`}
                  className="flex gap-4 border-b border-green-900/10 py-4 last:border-none"
                >
                  <Link
                    href={`/product/${item.product.slug}`}
                    onClick={closeDrawer}
                    className="relative size-20 shrink-0 overflow-hidden rounded"
                  >
                    <ProductMedia
                      src={item.product.images[0]?.url}
                      fallbackPhoto={item.product.fallbackPhoto}
                      visual={item.product.visual}
                      alt={item.product.name}
                      sizes="80px"
                      pattern={false}
                    />
                  </Link>
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/product/${item.product.slug}`}
                        onClick={closeDrawer}
                        className="text-sm font-semibold text-green-950 hover:text-green-900"
                      >
                        {item.product.name}
                      </Link>
                      <button
                        aria-label="Remove item"
                        onClick={() => removeItem(item.product.id, item.variant.id)}
                        className="shrink-0 cursor-pointer text-brown-500/70 hover:text-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <p className="text-xs text-brown-500">{item.variant.label}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <div className="flex items-center gap-2 rounded border border-green-900/20">
                        <button
                          aria-label="Decrease quantity"
                          onClick={() =>
                            updateQuantity(item.product.id, item.variant.id, item.quantity - 1)
                          }
                          className="flex size-7 cursor-pointer items-center justify-center text-green-950 hover:bg-green-950/5"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-4 text-center text-xs font-semibold text-green-950">
                          {item.quantity}
                        </span>
                        <button
                          aria-label="Increase quantity"
                          onClick={() =>
                            updateQuantity(item.product.id, item.variant.id, item.quantity + 1)
                          }
                          className="flex size-7 cursor-pointer items-center justify-center text-green-950 hover:bg-green-950/5"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-green-950">
                        {formatBDT(item.lineTotal)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-green-900/10 px-6 py-5">
              <div className="mb-4 flex items-center justify-between text-base">
                <span className="text-brown-500">Subtotal</span>
                <span className="font-semibold text-green-950">{formatBDT(subtotal)}</span>
              </div>
              <div className="flex flex-col gap-2">
                <ButtonLink
                  variant="gold"
                  size="lg"
                  className="w-full"
                  onClick={closeDrawer}
                  href="/checkout"
                >
                  Checkout
                </ButtonLink>
                <ButtonLink
                  variant="outline"
                  size="md"
                  className="w-full"
                  onClick={closeDrawer}
                  href="/cart"
                >
                  View Cart
                </ButtonLink>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

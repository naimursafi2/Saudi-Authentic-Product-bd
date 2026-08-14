"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "@/context/CartContext";

export function AddToCartButton({
  productId,
  variantId,
}: {
  productId: string;
  variantId: string;
}) {
  const { addItem } = useCart();

  return (
    <button
      type="button"
      aria-label="Add to cart"
      onClick={() => addItem(productId, variantId, 1)}
      className="flex size-10 items-center justify-center rounded-full bg-green-900 text-white shadow-[0_1px_1px_rgba(0,0,0,0.05)] transition-transform hover:scale-105 hover:bg-green-950"
    >
      <ShoppingCart size={16} />
    </button>
  );
}

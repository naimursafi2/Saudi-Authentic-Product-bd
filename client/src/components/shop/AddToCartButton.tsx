"use client";

import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/Button";
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
    <Button
      type="button"
      variant="primary"
      size="xs"
      aria-label="Add to cart"
      onClick={() => addItem(productId, variantId, 1)}
      className="w-full gap-2 rounded-full shadow-sm transition-all duration-300 hover:shadow-[0_6px_16px_rgba(1,45,29,0.25)]"
    >
      <ShoppingCart size={14} />
      Add to Cart
    </Button>
  );
}

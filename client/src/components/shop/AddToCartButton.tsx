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
      variant="addToCart"
      size="sm"
      aria-label="Add to cart"
      onClick={() => addItem(productId, variantId, 1)}
      className="w-full gap-2"
    >
      <ShoppingCart size={16} />
      Add to Cart
    </Button>
  );
}

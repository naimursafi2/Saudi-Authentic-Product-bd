"use client";

import { Heart } from "lucide-react";
import { useWishlist } from "@/context/WishlistContext";
import { ProductCard } from "@/components/ui/ProductCard";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

export default function WishlistPage() {
  const { items } = useWishlist();

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-6 py-24 text-center">
        <Heart size={40} className="text-brown-500/50" />
        <h1 className="font-serif text-3xl text-green-950">Your wishlist is empty</h1>
        <p className="max-w-sm text-sm text-brown-500">
          Tap the heart icon on any product to save it here for later.
        </p>
        <ButtonLink href="/shop" variant="primary" size="md" className="mt-2">
          Browse Products
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10 sm:px-10 lg:px-16 lg:py-14">
      <div className="mb-10">
        <SectionHeading title="Your Wishlist" align="left" dividerWidth={64} />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}

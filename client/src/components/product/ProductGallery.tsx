"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ProductMedia } from "@/components/ui/ProductMedia";
import type { Product } from "@/types/product";

export function ProductGallery({ product }: { product: Product }) {
  const [active, setActive] = useState(0);
  const hasImages = product.images.length > 0;
  // With real photos, show exactly what's uploaded. With a single curated photo
  // there's nothing to switch between, so the strip is hidden rather than
  // repeating the same shot four times. With neither, fall back to a few tiles
  // of the decorative visual so the gallery still feels full.
  const thumbnailCount = hasImages
    ? product.images.length
    : product.fallbackPhoto
      ? 0
      : 3;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-gold-500/20 shadow-[0_4px_20px_rgba(61,43,31,0.08)]">
        {product.badge && (
          <span className="absolute left-4 top-4 z-10 rounded-full bg-gold-soft px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-gold-700">
            {product.badge}
          </span>
        )}
        <ProductMedia
          src={hasImages ? (product.images[active]?.url ?? product.images[0].url) : undefined}
          fallbackPhoto={product.fallbackPhoto}
          visual={product.visual}
          variant={active}
          alt={product.name}
          sizes="(min-width: 1024px) 50vw, 100vw"
          priority
        />
      </div>
      {thumbnailCount > 0 && (
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: thumbnailCount }).map((_, i) => (
          <button
            key={i}
            aria-label={`Show image ${i + 1}`}
            onClick={() => setActive(i)}
            className={cn(
              "relative aspect-square cursor-pointer overflow-hidden rounded border-2 transition-colors",
              active === i ? "border-green-900" : "border-transparent"
            )}
          >
            {hasImages ? (
              <Image
                src={product.images[i].url}
                alt={`${product.name} thumbnail ${i + 1}`}
                fill
                sizes="120px"
                className="object-cover"
              />
            ) : (
              <ProductMedia
                visual={product.visual}
                variant={i}
                pattern={i === active}
                alt=""
                sizes="120px"
              />
            )}
          </button>
        ))}
      </div>
      )}
    </div>
  );
}

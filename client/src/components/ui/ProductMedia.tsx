import Image from "next/image";
import { cn } from "@/lib/utils";
import type { ProductVisual as ProductVisualSpec } from "@/types/product";
import { ProductVisual } from "./ProductVisual";

/**
 * Single source of truth for "what do we render in a product/category image
 * slot", so every surface (cards, gallery, cart, drawer, checkout, search)
 * degrades identically:
 *
 *   1. a real uploaded Cloudinary photo, if the record has one
 *   2. otherwise a curated local photo for that variety (`lib/productPhotos.ts`)
 *   3. otherwise the decorative `<ProductVisual>` gradient
 *
 * The caller owns the box — this always fills its parent, which must be
 * positioned (`relative`) and sized, exactly like `<ProductVisual>` was.
 */

interface ProductMediaProps {
  /** Uploaded image URL, if any. */
  src?: string;
  /** Curated local photo for this variety, if we have one. */
  fallbackPhoto?: string;
  /** Decorative gradient spec used when there's no photo at all. */
  visual: ProductVisualSpec;
  alt: string;
  /** Responsive sizes hint for next/image. Required so we never ship a full-width image to a thumbnail. */
  sizes: string;
  className?: string;
  /** Forwarded to <ProductVisual> only. */
  pattern?: boolean;
  /** Forwarded to <ProductVisual> only. */
  variant?: number;
  priority?: boolean;
  /**
   * Force how the photo fills its box, overriding the per-source default
   * below. Product-listing cards pass `"cover"` so every card's image is
   * exactly the same shape regardless of which source it came from —
   * mixing cropped and letterboxed images across a grid made the cards look
   * misaligned even though their boxes were identical.
   */
  fit?: "cover" | "contain";
}

export function ProductMedia({
  src,
  fallbackPhoto,
  visual,
  alt,
  sizes,
  className,
  pattern,
  variant,
  priority,
  fit,
}: ProductMediaProps) {
  const photo = src ?? fallbackPhoto;

  if (photo) {
    // Default per source: uploaded photography is shot to fill its slot, so
    // it crops (`cover`); our curated local shots are square with a white
    // studio background, so they're fitted (`contain`) on a cream ground.
    // An explicit `fit` overrides that — see the prop's comment.
    const isCuratedPhoto = !src;
    const useContain = fit ? fit === "contain" : isCuratedPhoto;
    return (
      <Image
        src={photo}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn(useContain ? "bg-cream-50 object-contain p-2" : "object-cover", className)}
      />
    );
  }

  return <ProductVisual {...visual} pattern={pattern} variant={variant} className={className} />;
}

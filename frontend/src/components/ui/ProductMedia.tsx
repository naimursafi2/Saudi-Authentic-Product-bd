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
}: ProductMediaProps) {
  const photo = src ?? fallbackPhoto;

  if (photo) {
    // Uploaded photography is shot to fill its slot, so it crops (`cover`) as before.
    // Our curated local shots are square with a white studio background, so they're
    // fitted (`contain`) on a cream ground — never cropped, never stretched.
    const isCuratedPhoto = !src;
    return (
      <Image
        src={photo}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn(isCuratedPhoto ? "bg-cream-50 object-contain p-2" : "object-cover", className)}
      />
    );
  }

  return <ProductVisual {...visual} pattern={pattern} variant={variant} className={className} />;
}

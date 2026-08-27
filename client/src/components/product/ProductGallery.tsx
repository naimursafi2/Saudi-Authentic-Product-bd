"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductMedia } from "@/components/ui/ProductMedia";
import type { Product, ProductImage } from "@/types/product";

export function ProductGallery({ product }: { product: Product }) {
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
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

  const goToImage = useCallback(
    (index: number) => {
      if (!hasImages) return;
      const total = product.images.length;
      setActive(((index % total) + total) % total);
    },
    [hasImages, product.images.length]
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 sm:max-w-lg lg:max-w-none">
      <button
        type="button"
        aria-label={hasImages ? "Open full-size image" : undefined}
        disabled={!hasImages}
        onClick={() => hasImages && setLightboxOpen(true)}
        className={cn(
          "group relative aspect-square w-full overflow-hidden rounded-lg border border-gold-500/20 text-left shadow-[0_4px_20px_rgba(61,43,31,0.08)]",
          hasImages && "cursor-zoom-in"
        )}
      >
        {product.badge && (
          <span className="absolute left-4 top-4 z-10 rounded-full bg-gold-soft px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-gold-700">
            {product.badge}
          </span>
        )}
        <div className="size-full">
          <ProductMedia
            src={hasImages ? (product.images[active]?.url ?? product.images[0].url) : undefined}
            fallbackPhoto={product.fallbackPhoto}
            visual={product.visual}
            variant={active}
            alt={product.name}
            sizes="(min-width: 1024px) 50vw, (min-width: 640px) 32rem, 100vw"
            priority
          />
        </div>
        {hasImages && (
          <span className="pointer-events-none absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full bg-white/90 text-green-950 opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100">
            <ZoomIn size={17} />
          </span>
        )}
      </button>
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

      {hasImages && lightboxOpen && (
        <ImageLightbox
          images={product.images}
          active={active}
          productName={product.name}
          onClose={() => setLightboxOpen(false)}
          onNavigate={goToImage}
        />
      )}
    </div>
  );
}

/**
 * Fullscreen image viewer — a separate light layer above everything else in
 * the app (mobile drawer is z-[90], SearchOverlay z-[70]), following the
 * same "backdrop button behind, content as a sibling" pattern SearchOverlay
 * uses: clicking the backdrop closes it, clicking the content doesn't, with
 * no stopPropagation trickery needed. Backdrop is near-black rather than the
 * brand's green scrim used elsewhere (mobile drawer, etc.) — a tinted
 * backdrop would visibly shift how the product photo's own colors read,
 * which matters for a zoom/detail view meant to show the product accurately.
 */
function ImageLightbox({
  images,
  active,
  productName,
  onClose,
  onNavigate,
}: {
  images: ProductImage[];
  active: number;
  productName: string;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const hasMultiple = images.length > 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && hasMultiple) onNavigate(active + 1);
      else if (e.key === "ArrowLeft" && hasMultiple) onNavigate(active - 1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onNavigate, active, hasMultiple]);

  return (
    <div className="fixed inset-0 z-[110] animate-fade-in">
      <button
        aria-label="Close full-size image"
        className="absolute inset-0 cursor-zoom-out bg-black/95"
        onClick={onClose}
      />

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 p-4 sm:p-8">
        {/* pointer-events-auto (not inherited none): clicking the image
            itself must not fall through to the backdrop button beneath it
            and close the lightbox — only clicking outside it should. */}
        <div className="pointer-events-auto relative h-[70vh] w-full max-w-4xl sm:h-[75vh]">
          <Image
            src={images[active].url}
            alt={`${productName} — full size, image ${active + 1} of ${images.length}`}
            fill
            sizes="90vw"
            className="object-contain"
            priority
          />
        </div>

        {hasMultiple && (
          <div className="pointer-events-auto flex max-w-full gap-2 overflow-x-auto px-2 pb-1">
            {images.map((image, index) => (
              <button
                key={image.publicId}
                type="button"
                aria-label={`Go to image ${index + 1}`}
                aria-current={index === active}
                onClick={() => onNavigate(index)}
                className={cn(
                  "relative size-14 shrink-0 cursor-pointer overflow-hidden rounded border-2 transition-colors sm:size-16",
                  index === active ? "border-gold-500" : "border-white/25 hover:border-white/50"
                )}
              >
                <Image src={image.url} alt="" fill sizes="64px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="pointer-events-auto absolute right-4 top-4 z-10 flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 sm:right-6 sm:top-6"
      >
        <X size={20} />
      </button>

      {hasMultiple && (
        <>
          <button
            type="button"
            aria-label="Previous image"
            onClick={() => onNavigate(active - 1)}
            className="pointer-events-auto absolute left-2 top-1/2 z-10 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 sm:left-6 sm:size-11"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            aria-label="Next image"
            onClick={() => onNavigate(active + 1)}
            className="pointer-events-auto absolute right-2 top-1/2 z-10 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 sm:right-6 sm:size-11"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}
    </div>
  );
}

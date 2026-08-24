"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import type { ApiHomepageSection } from "@/types/api";

/**
 * The homepage's dual/carousel promotional banner row — every visible
 * `banner`-type `HomepageSection` (see its model comment) rendered together
 * here, not individually. 2-up side by side from `md` up, 1-up below it,
 * with previous/next arrows whenever there's more than one banner — an
 * unlimited number of banners works with no code change, since layout and
 * paging are both driven by native horizontal scroll-snap rather than a
 * fixed-count grid.
 *
 * Deliberately NOT built like `HeroCarousel` (opacity-crossfaded absolute
 * slides + JS autoplay): a banner here is a pure image with no title/CTA
 * overlay, so there's nothing to crossfade between, and scroll-snap gives
 * touch-swipe for free instead of hand-rolled pointer tracking. Arrows just
 * scroll the track by one viewport width, which naturally advances "1 card"
 * on mobile and "2 cards" on desktop without needing to know how many are
 * visible.
 */
export function BannerCarousel({ banners }: { banners: ApiHomepageSection[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const hasMultiple = banners.length > 1;

  const updateArrowState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanScrollPrev(track.scrollLeft > 4);
    setCanScrollNext(track.scrollLeft < track.scrollWidth - track.clientWidth - 4);
  }, []);

  useEffect(() => {
    updateArrowState();
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener("scroll", updateArrowState, { passive: true });
    window.addEventListener("resize", updateArrowState);
    return () => {
      track.removeEventListener("scroll", updateArrowState);
      window.removeEventListener("resize", updateArrowState);
    };
  }, [updateArrowState, banners.length]);

  function scrollByPage(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({
      left: direction * track.clientWidth,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }

  if (banners.length === 0) return null;

  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="relative mx-auto max-w-[1200px]">
        <div
          ref={trackRef}
          className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth md:gap-4 lg:gap-6"
        >
          {banners.map((banner) => (
            <div
              key={banner._id}
              className="relative aspect-[16/9] w-full shrink-0 snap-start overflow-hidden rounded-2xl bg-cream-200 md:w-[calc(50%-0.5rem)] lg:w-[calc(50%-0.75rem)]"
            >
              {banner.image?.url && (
                <Image
                  src={banner.image.url}
                  alt={banner.title || "Promotional banner"}
                  fill
                  sizes="(max-width: 768px) 100vw, 600px"
                  className="object-cover"
                />
              )}
            </div>
          ))}
        </div>

        {hasMultiple && (
          <>
            <button
              type="button"
              aria-label="Previous banner"
              disabled={!canScrollPrev}
              onClick={() => scrollByPage(-1)}
              className="absolute left-2 top-1/2 z-10 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-brand-deep/70 text-on-brand backdrop-blur transition-colors duration-200 ease-in-out hover:bg-brand-deep/90 disabled:pointer-events-none disabled:opacity-0 sm:size-10 lg:left-4"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              aria-label="Next banner"
              disabled={!canScrollNext}
              onClick={() => scrollByPage(1)}
              className="absolute right-2 top-1/2 z-10 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-brand-deep/70 text-on-brand backdrop-blur transition-colors duration-200 ease-in-out hover:bg-brand-deep/90 disabled:pointer-events-none disabled:opacity-0 sm:size-10 lg:right-4"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

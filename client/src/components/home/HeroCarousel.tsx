"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

export interface HeroSlideData {
  id: string;
  /** Admin-uploaded image URL, or null when none is set — see HeroBanner. */
  image: string | null;
}

const AUTOPLAY_MS = 4500;
/** Horizontal travel (px) that counts as a swipe rather than a tap. */
const SWIPE_THRESHOLD = 40;

/**
 * Pure-image hero carousel — one image fills the banner at a time, with no
 * text/CTA overlay. Renders a static single image when there is only one
 * active slide, or an auto-rotating, looping carousel when the admin has
 * configured several — arrows (hidden until the banner is hovered/focused),
 * dots below the image, and swipe on touch devices.
 *
 * The image comes exclusively from the database (see HeroBanner); there is
 * no bundled default image and no hardcoded slide content here. Do not
 * reintroduce either — a hardcoded value silently overrides whatever the
 * admin configured and makes the banner look un-editable.
 */
export function HeroCarousel({ slides }: { slides: HeroSlideData[] }) {
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  /**
   * Bumped by every manual navigation. It is a dependency of the autoplay
   * effect purely so the interval is torn down and recreated: without it, a
   * click landing 5.9s into the cycle would be followed by an automatic
   * advance 0.1s later, which reads as the carousel jumping away from the
   * slide the visitor just chose. Restarting hands them a full interval.
   */
  const [restartKey, setRestartKey] = useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const swipeStartX = useRef<number | null>(null);
  const hasMultiple = slides.length > 1;
  const autoplays = hasMultiple && !prefersReducedMotion;

  useEffect(() => {
    if (!autoplays || isPaused) return;
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [autoplays, isPaused, slides.length, restartKey]);

  const goTo = useCallback(
    (index: number) => {
      setActive(((index % slides.length) + slides.length) % slides.length);
      setRestartKey((n) => n + 1);
    },
    [slides.length]
  );

  // Touch/pen swipe only. Mouse drags are deliberately left alone so the
  // arrows' hover affordance still works normally on desktop.
  function handlePointerDown(e: React.PointerEvent) {
    if (!hasMultiple || e.pointerType === "mouse") return;
    swipeStartX.current = e.clientX;
  }

  function handlePointerUp(e: React.PointerEvent) {
    const startX = swipeStartX.current;
    swipeStartX.current = null;
    if (startX == null) return;
    const delta = e.clientX - startX;
    // Below the threshold this was a tap, not a swipe.
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    goTo(delta < 0 ? active + 1 : active - 1);
  }

  return (
    /* Contained promotional banner, not a full-bleed hero: this wrapper
       supplies the side margins, and the banner itself is a rounded card. */
    <div className="px-4 pb-5 pt-8 sm:px-6 sm:pt-10 lg:px-8 lg:pt-12">
      <div className="mx-auto max-w-[1200px]">
        <section
          aria-roledescription={hasMultiple ? "carousel" : undefined}
          aria-label={hasMultiple ? "Homepage banners" : undefined}
          className="group relative isolate flex min-h-[240px] items-center overflow-hidden rounded-2xl bg-brand-deep sm:min-h-[280px] lg:min-h-[340px]"
          /* Pause on hover for mice and on focus for keyboards, so autoplay
             never yanks the image away mid-interaction. Also what reveals
             the arrows — hidden until the banner is hovered/focused. */
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocusCapture={() => setIsPaused(true)}
          onBlurCapture={() => setIsPaused(false)}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            swipeStartX.current = null;
          }}
        >
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              aria-hidden={index !== active}
              className={cn(
                "absolute inset-0 transition-opacity duration-700 ease-out",
                index === active ? "opacity-100" : "pointer-events-none opacity-0"
              )}
            >
              {slide.image && (
                <Image
                  src={slide.image}
                  alt=""
                  fill
                  sizes="(max-width: 1200px) 100vw, 1200px"
                  priority={index === 0}
                  className="object-cover"
                />
              )}
            </div>
          ))}

          {hasMultiple && (
            <>
              <button
                type="button"
                aria-label="Previous slide"
                onClick={() => goTo(active - 1)}
                className="absolute left-2 top-1/2 z-10 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white opacity-0 backdrop-blur transition-opacity duration-200 ease-in-out group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-white/25 sm:size-10 lg:left-6"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                aria-label="Next slide"
                onClick={() => goTo(active + 1)}
                className="absolute right-2 top-1/2 z-10 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white opacity-0 backdrop-blur transition-opacity duration-200 ease-in-out group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-white/25 sm:size-10 lg:right-6"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </section>

        {hasMultiple && (
          <div className="mt-4 flex justify-center gap-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === active}
                onClick={() => goTo(index)}
                className={cn(
                  "h-1.5 cursor-pointer rounded-full transition-all",
                  index === active ? "w-7 bg-gold-500" : "w-1.5 bg-green-900/20 hover:bg-green-900/35"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

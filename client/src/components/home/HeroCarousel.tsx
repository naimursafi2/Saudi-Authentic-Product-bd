"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface HeroSlideData {
  id: string;
  title: string;
  subtitle: string;
  /** Admin-uploaded image URL, or null when none is set — see HeroBanner. */
  image: string | null;
  ctaLabel: string;
  ctaHref: string;
  /**
   * Optional second button, rendered only when a label is set. There is no
   * hardcoded fallback button: this replaced a fixed "Explore Dates" link
   * that appeared on every slide regardless of what the admin configured.
   */
  secondaryCtaLabel: string | null;
  secondaryCtaHref: string | null;
}

const AUTOPLAY_MS = 6000;
/** Horizontal travel (px) that counts as a swipe rather than a tap. */
const SWIPE_THRESHOLD = 40;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * Reads the viewer's reduced-motion preference without a setState-in-effect
 * (which this project's lint config rejects). The server snapshot is `false`
 * so SSR and the first client render agree, and React re-renders on its own
 * if the OS setting changes mid-session.
 */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false
  );
}

/**
 * Contained promotional banner (not a full-bleed hero). Renders a static
 * single slide when there is only one, or an auto-rotating carousel when the
 * admin has configured several active slides — arrows, dots, and swipe on
 * touch devices.
 *
 * Every slide's image, headline, subtitle and both buttons come from the
 * database (see HeroBanner); there is no bundled default image and no
 * hardcoded slide content here. Do not reintroduce either — a hardcoded
 * value silently overrides whatever the admin configured and makes the
 * banner look un-editable.
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

  // Touch/pen swipe only. Mouse drags are deliberately left alone so text
  // selection still works on desktop, where the arrows are always visible.
  function handlePointerDown(e: React.PointerEvent) {
    if (!hasMultiple || e.pointerType === "mouse") return;
    swipeStartX.current = e.clientX;
  }

  function handlePointerUp(e: React.PointerEvent) {
    const startX = swipeStartX.current;
    swipeStartX.current = null;
    if (startX == null) return;
    const delta = e.clientX - startX;
    // Below the threshold this was a tap on a button or link, not a swipe.
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    goTo(delta < 0 ? active + 1 : active - 1);
  }

  return (
    /* Contained promotional banner, not a full-bleed hero: this wrapper
       supplies the side margins, and the banner itself is a rounded card
       roughly half the old height. */
    <div className="px-4 py-5 sm:px-6 lg:px-8">
      <section
        aria-roledescription={hasMultiple ? "carousel" : undefined}
        aria-label={hasMultiple ? "Promotional banners" : undefined}
        className="relative isolate mx-auto flex min-h-[240px] max-w-[1200px] items-center overflow-hidden rounded-2xl bg-brand-deep sm:min-h-[280px] lg:min-h-[340px]"
        /* Pause on hover for mice and on focus for keyboards, so autoplay
           never yanks a link out from under someone mid-interaction. */
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
            <div className="absolute inset-0 bg-gradient-to-r from-brand-deep/92 via-brand-deep/60 to-brand-deep/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/50 via-transparent to-transparent" />
          </div>
        ))}

        <div className="relative z-10 w-full px-6 sm:px-9 lg:px-12">
          <div className="flex max-w-lg flex-col gap-4 py-10 lg:py-12">
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                aria-hidden={index !== active}
                className={cn(
                  "flex flex-col gap-6 transition-opacity duration-700",
                  index === active ? "opacity-100" : "pointer-events-none absolute opacity-0"
                )}
              >
                <h1 className="font-serif text-2xl font-semibold leading-tight tracking-[-0.02em] text-white sm:text-3xl lg:text-4xl">
                  {slide.title.split("\n").map((line, i, lines) => (
                    <span key={i}>
                      {line}
                      {i < lines.length - 1 && <br />}
                    </span>
                  ))}
                </h1>
                <p className="max-w-md text-sm text-on-brand/90 sm:text-base">{slide.subtitle}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  {/* Off-screen slides are taken out of the tab order so a
                      keyboard user can't focus a link they can't see. */}
                  <ButtonLink
                    href={slide.ctaHref}
                    variant="gold"
                    size="md"
                    tabIndex={index === active ? undefined : -1}
                  >
                    {slide.ctaLabel}
                  </ButtonLink>
                  {slide.secondaryCtaLabel && (
                    <ButtonLink
                      href={slide.secondaryCtaHref || "/shop"}
                      variant="outline"
                      size="md"
                      tabIndex={index === active ? undefined : -1}
                      className="border-white/50 text-white hover:bg-white/10"
                    >
                      {slide.secondaryCtaLabel}
                    </ButtonLink>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {hasMultiple && (
          <>
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => goTo(active - 1)}
              className="absolute left-2 top-1/2 z-10 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25 sm:size-10 lg:left-6"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => goTo(active + 1)}
              className="absolute right-2 top-1/2 z-10 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25 sm:size-10 lg:right-6"
            >
              <ChevronRight size={20} />
            </button>
            <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center gap-2">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={`Go to slide ${index + 1}`}
                  aria-current={index === active}
                  onClick={() => goTo(index)}
                  className={cn(
                    "h-1.5 cursor-pointer rounded-full transition-all",
                    index === active ? "w-7 bg-gold-500" : "w-1.5 bg-white/50 hover:bg-white/70"
                  )}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface HeroSlideData {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  ctaLabel: string;
  ctaHref: string;
}

const AUTOPLAY_MS = 6000;

/** Full-bleed hero banner. Renders a static single slide when there's only
 * one, or an auto-rotating carousel (dots + arrows, pause on hover) when
 * the admin has configured multiple active hero slides. */
export function HeroCarousel({ slides }: { slides: HeroSlideData[] }) {
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasMultiple = slides.length > 1;

  useEffect(() => {
    if (!hasMultiple || isPaused) return;
    timerRef.current = setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasMultiple, isPaused, slides.length]);

  function goTo(index: number) {
    setActive((index + slides.length) % slides.length);
  }

  return (
    <section
      className="relative isolate flex min-h-[520px] items-center overflow-hidden bg-green-950 sm:min-h-[620px] lg:min-h-[720px]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
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
          <Image
            src={slide.image}
            alt=""
            fill
            sizes="100vw"
            priority={index === 0}
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/92 via-green-950/60 to-green-950/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-green-950/50 via-transparent to-transparent" />
        </div>
      ))}

      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-6 sm:px-10 lg:px-16">
        <div className="flex max-w-xl flex-col gap-6 py-16 lg:py-20">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              aria-hidden={index !== active}
              className={cn(
                "flex flex-col gap-6 transition-opacity duration-700",
                index === active ? "opacity-100" : "pointer-events-none absolute opacity-0"
              )}
            >
              <h1 className="font-serif text-4xl font-semibold leading-tight tracking-[-0.02em] text-white sm:text-5xl lg:text-[56px] lg:leading-[64px]">
                {slide.title.split("\n").map((line, i) => (
                  <span key={i}>
                    {line}
                    {i < slide.title.split("\n").length - 1 && <br />}
                  </span>
                ))}
              </h1>
              <p className="max-w-md text-base text-cream-100/90 sm:text-lg">{slide.subtitle}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <ButtonLink href={slide.ctaHref} variant="gold" size="lg">
                  {slide.ctaLabel}
                </ButtonLink>
                <ButtonLink
                  href="/shop?category=dates"
                  variant="outline"
                  size="lg"
                  className="border-white/50 text-white hover:bg-white/10"
                >
                  Explore Dates
                </ButtonLink>
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
            className="absolute left-3 top-1/2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25 sm:flex lg:left-6"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => goTo(active + 1)}
            className="absolute right-3 top-1/2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25 sm:flex lg:right-6"
          >
            <ChevronRight size={20} />
          </button>
          <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center gap-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Go to slide ${index + 1}`}
                onClick={() => goTo(index)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === active ? "w-7 bg-gold-500" : "w-1.5 bg-white/50 hover:bg-white/70"
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

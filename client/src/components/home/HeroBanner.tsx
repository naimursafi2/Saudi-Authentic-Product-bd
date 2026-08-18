import { listHeroSlides } from "@/lib/api/heroSlides";
import { HeroCarousel, type HeroSlideData } from "@/components/home/HeroCarousel";
import type { ApiHomepageSection } from "@/types/api";

const FALLBACK_TITLE = "Authentic Saudi Products\nDelivered to Your Doorstep.";
const FALLBACK_SUBTITLE =
  "Experience the finest quality dates, exclusive gift boxes, and authentic heritage pieces curated for the discerning collector.";
const FALLBACK_IMAGE = "/images/editorial/medjool-dates.webp";

export async function HeroBanner({ section }: { section?: ApiHomepageSection }) {
  // Hero slides are managed from the admin portal (image/title/subtitle/CTA/order).
  // All active slides render as a carousel, sorted by order.
  const { data } = await listHeroSlides();

  const slides: HeroSlideData[] =
    data.slides.length > 0
      ? data.slides.map((slide) => ({
          id: slide._id,
          title: slide.title,
          subtitle: slide.subtitle || FALLBACK_SUBTITLE,
          image: slide.image?.url || FALLBACK_IMAGE,
          ctaLabel: slide.ctaLabel || "Shop Now",
          ctaHref: slide.ctaHref || "/shop",
        }))
      : [
          {
            id: "fallback",
            title: section?.title || FALLBACK_TITLE,
            subtitle: section?.subtitle || FALLBACK_SUBTITLE,
            image: FALLBACK_IMAGE,
            ctaLabel: "Shop Now",
            ctaHref: "/shop",
          },
        ];

  return <HeroCarousel slides={slides} />;
}

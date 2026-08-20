import { listHeroSlides } from "@/lib/api/heroSlides";
import { HeroCarousel, type HeroSlideData } from "@/components/home/HeroCarousel";
import type { ApiHomepageSection } from "@/types/api";

/**
 * Text-only fallbacks, used when the admin has left a field blank. There is
 * deliberately NO image fallback: the banner image comes exclusively from
 * the database (a hero slide's uploaded image, or failing that the `hero`
 * homepage section's own uploaded image), both editable from the admin
 * portal. Do not reintroduce a bundled `/images/...` default — it silently
 * overrides whatever the admin actually uploaded and makes the banner look
 * un-editable. A hero with no image set simply renders on the brand's deep
 * green background, which is a valid, intentional look.
 */
const FALLBACK_TITLE = "Authentic Saudi Products\nDelivered to Your Doorstep.";
const FALLBACK_SUBTITLE =
  "Experience the finest quality dates, exclusive gift boxes, and authentic heritage pieces curated for the discerning collector.";

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
          image: slide.image?.url ?? null,
          ctaLabel: slide.ctaLabel || "Shop Now",
          ctaHref: slide.ctaHref || "/shop",
          secondaryCtaLabel: slide.secondaryCtaLabel || null,
          secondaryCtaHref: slide.secondaryCtaHref || null,
        }))
      : [
          {
            id: "hero-section",
            title: section?.title || FALLBACK_TITLE,
            subtitle: section?.subtitle || FALLBACK_SUBTITLE,
            // The `hero` homepage section carries its own admin-uploaded
            // image — still database-driven, not a bundled asset.
            image: section?.image?.url ?? null,
            ctaLabel: section?.ctaLabel || "Shop Now",
            ctaHref: section?.ctaHref || "/shop",
            // The `hero` section has no second CTA of its own, so the
            // fallback banner shows a single button rather than inventing one.
            secondaryCtaLabel: null,
            secondaryCtaHref: null,
          },
        ];

  return <HeroCarousel slides={slides} />;
}

import { listHeroSlides } from "@/lib/api/heroSlides";
import { HeroCarousel, type HeroSlideData } from "@/components/home/HeroCarousel";
import type { ApiHomepageSection } from "@/types/api";

export async function HeroBanner({ section }: { section?: ApiHomepageSection }) {
  // Hero slides are managed from the admin portal. All active slides render
  // as an image-only carousel, sorted by order — there is deliberately NO
  // image fallback here: the banner image comes exclusively from the
  // database (a hero slide's uploaded image, or failing that the `hero`
  // homepage section's own uploaded image), both editable from the admin
  // portal. Do not reintroduce a bundled `/images/...` default — it silently
  // overrides whatever the admin actually uploaded and makes the banner look
  // un-editable. A hero with no image set simply renders on the brand's deep
  // green background, which is a valid, intentional look.
  const { data } = await listHeroSlides();

  const slides: HeroSlideData[] =
    data.slides.length > 0
      ? data.slides.map((slide) => ({ id: slide._id, image: slide.image?.url ?? null }))
      : [{ id: "hero-section", image: section?.image?.url ?? null }];

  return <HeroCarousel slides={slides} />;
}

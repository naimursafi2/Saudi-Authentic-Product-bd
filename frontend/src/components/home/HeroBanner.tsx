import { BadgeCheck, Globe2, ShieldCheck, Truck } from "lucide-react";
import { listHeroSlides } from "@/lib/api/heroSlides";
import { HeroCarousel, type HeroSlideData } from "@/components/home/HeroCarousel";
import type { ApiHomepageSection } from "@/types/api";

const BENEFITS = [
  { icon: BadgeCheck, label: "100% Authentic" },
  { icon: Globe2, label: "Imported from Saudi" },
  { icon: Truck, label: "Fast Delivery" },
  { icon: ShieldCheck, label: "Quality Assured" },
];

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

  return (
    <>
      <HeroCarousel slides={slides} />
      <ul className="mx-auto grid w-full max-w-[1200px] grid-cols-2 gap-x-6 gap-y-5 border-b border-brown-600/10 px-6 py-8 sm:grid-cols-4 sm:gap-4 sm:px-10 lg:px-16">
        {BENEFITS.map(({ icon: Icon, label }) => (
          <li key={label} className="flex flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green-950 text-gold-500">
              <Icon size={16} strokeWidth={2} />
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-green-950 sm:text-[13px]">
              {label}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

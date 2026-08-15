import Image from "next/image";
import { BadgeCheck, Globe2, ShieldCheck, Truck } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { SealBadge } from "@/components/ui/SealBadge";
import { listHeroSlides } from "@/lib/api/heroSlides";
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
  // Slides are returned active-only, sorted by order — the top one is featured.
  const { data } = await listHeroSlides();
  const slide = data.slides[0];

  // The active hero slide is the primary way to change the banner (image +
  // headline + subtitle + CTA together); the "Hero Banner" section doc only
  // supplies the text when no slide has been configured yet.
  const titleLines = (slide?.title || section?.title || FALLBACK_TITLE).split("\n");
  const subtitle = slide?.subtitle || section?.subtitle || FALLBACK_SUBTITLE;
  const image = slide?.image?.url ?? FALLBACK_IMAGE;
  const primaryCtaLabel = slide?.ctaLabel || "Shop Now";
  const primaryCtaHref = slide?.ctaHref || "/shop";

  return (
    <section className="relative flex min-h-[560px] items-center justify-center overflow-hidden bg-cream-400 sm:min-h-[640px] lg:min-h-[760px]">
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 20%, rgba(212,175,55,0.35), transparent 45%), radial-gradient(circle at 85% 15%, rgba(27,67,50,0.3), transparent 45%), radial-gradient(circle at 50% 100%, rgba(112,90,76,0.35), transparent 55%)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cream-100/10 to-cream-100/40" />

      <div className="relative mx-auto flex w-full max-w-[1200px] flex-col items-center gap-12 px-6 py-16 sm:px-12 lg:py-20">
        <div className="flex w-full flex-col items-center gap-10 text-center lg:flex-row lg:items-center lg:gap-16 lg:text-left">
          <div className="flex max-w-xl flex-col items-center gap-6 lg:items-start">
            <h1 className="font-serif text-4xl font-semibold leading-tight tracking-[-0.02em] text-green-950 drop-shadow-sm sm:text-5xl lg:text-[48px] lg:leading-[62px]">
              {titleLines.map((line, i) => (
                <span key={i}>
                  {line}
                  {i < titleLines.length - 1 && <br />}
                </span>
              ))}
            </h1>
            <p className="max-w-xl text-base text-ink-900 sm:text-lg">{subtitle}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <ButtonLink href={primaryCtaHref} variant="gold" size="lg">
                {primaryCtaLabel}
              </ButtonLink>
              <ButtonLink href="/shop?category=dates" variant="outline" size="lg">
                Explore Dates
              </ButtonLink>
            </div>
          </div>

          {/* Decorative product photography — mirrors the gold-ringed circular
              frame used by the category tiles so the two sections read as one system. */}
          <div className="flex shrink-0 justify-center lg:ml-auto">
            <span className="relative flex size-[240px] items-center justify-center rounded-full border border-gold-500/40 bg-cream-100/60 p-2.5 shadow-[0_8px_30px_rgba(61,43,31,0.15)] backdrop-blur-sm sm:size-[320px] lg:size-[400px]">
              <span className="relative size-full overflow-hidden rounded-full bg-cream-50">
                <Image
                  src={image}
                  alt="Premium Saudi dates"
                  fill
                  sizes="(min-width: 1024px) 400px, (min-width: 640px) 320px, 240px"
                  className="object-cover"
                  priority
                />
              </span>
              <SealBadge
                size={92}
                className="absolute -bottom-2 -right-2 sm:size-[104px] lg:-bottom-3 lg:-right-3 lg:size-[124px]"
              />
            </span>
          </div>
        </div>

        <ul className="grid w-full max-w-3xl grid-cols-2 gap-x-6 gap-y-5 border-t border-green-950/10 pt-8 sm:grid-cols-4 sm:gap-4">
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
      </div>
    </section>
  );
}

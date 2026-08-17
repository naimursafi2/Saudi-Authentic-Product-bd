import type { Metadata } from "next";
import Image from "next/image";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/Button";
import { getStaticPage } from "@/lib/api/staticPages";
import { STATIC_PAGE_BLOCK_ICON_MAP } from "@/lib/staticPageBlockIcons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "Learn about Saudi Authentic Product's mission to bring genuine Saudi and Madinah heritage products to Bangladesh.",
};

export default async function AboutPage() {
  const { data } = await getStaticPage("about");
  const page = data.page;
  const paragraphs = (page.heroDescription ?? "").split("\n\n").filter(Boolean);
  const values = page.blocks.filter((block) => block.isVisible);

  return (
    <>
      <section className="bg-cream-200 px-6 py-16 sm:px-10 lg:px-16 lg:py-20">
        <div className="mx-auto grid max-w-[1100px] grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
            <SectionHeading title={page.heroTitle ?? "Our Story"} size="lg" />
            {paragraphs.map((paragraph, i) => (
              <p key={i} className="text-base leading-relaxed text-brown-600 sm:text-lg">
                {paragraph}
              </p>
            ))}
          </div>
          <div className="relative mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-lg border border-gold-500/25 bg-cream-50 shadow-[0_8px_30px_rgba(61,43,31,0.12)]">
            <Image
              src={page.heroImage?.url ?? "/images/editorial/mashruk-dates.webp"}
              alt="Assorted premium Saudi dates"
              fill
              sizes="(min-width: 1024px) 420px, (min-width: 640px) 60vw, 90vw"
              className="object-cover"
              priority
            />
          </div>
        </div>
      </section>

      {values.length > 0 && (
        <section className="mx-auto max-w-[1200px] px-6 py-16 sm:px-10 lg:px-16 lg:py-20">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {values.map((value) => {
              const Icon = value.icon ? STATIC_PAGE_BLOCK_ICON_MAP[value.icon] : null;
              return (
                <div
                  key={value.title}
                  className="flex gap-4 rounded-lg border border-gold-500/20 bg-cream-100 p-6 shadow-[0_4px_15px_rgba(61,43,31,0.05)]"
                >
                  {Icon && <Icon size={26} className="mt-1 shrink-0 text-green-900" strokeWidth={1.5} />}
                  <div>
                    <h3 className="mb-1.5 font-serif text-lg font-semibold text-green-950">
                      {value.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-brown-500">{value.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {page.ctaTitle && (
        <section className="bg-green-900 px-6 py-16 text-center sm:px-10 lg:py-20">
          <div className="mx-auto flex max-w-xl flex-col items-center gap-5">
            <h2 className="font-serif text-3xl font-semibold text-white sm:text-4xl">{page.ctaTitle}</h2>
            {page.ctaDescription && (
              <p className="text-sm text-cream-100/80 sm:text-base">{page.ctaDescription}</p>
            )}
            {page.ctaButtonLabel && page.ctaButtonHref && (
              <ButtonLink href={page.ctaButtonHref} variant="gold" size="lg">
                {page.ctaButtonLabel}
              </ButtonLink>
            )}
          </div>
        </section>
      )}
    </>
  );
}

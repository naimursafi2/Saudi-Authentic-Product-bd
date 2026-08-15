import Image from "next/image";
import { ButtonLink } from "@/components/ui/Button";
import type { ApiHomepageSection } from "@/types/api";

/** Freely creatable/deletable promotional banner — fully admin-authored content. */
export function PromoBanner({ section }: { section: ApiHomepageSection }) {
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-10 sm:px-10 lg:px-16">
      <div className="relative flex flex-col overflow-hidden rounded-lg bg-green-900 sm:flex-row sm:items-center">
        {section.image?.url && (
          <div className="relative h-48 w-full shrink-0 sm:h-auto sm:w-2/5">
            <Image
              src={section.image.url}
              alt={section.title ?? "Promotional offer"}
              fill
              sizes="(min-width: 640px) 40vw, 100vw"
              className="object-cover"
            />
          </div>
        )}
        <div className="flex flex-1 flex-col items-start gap-3 px-6 py-8 sm:px-10">
          {section.title && (
            <h2 className="font-serif text-2xl font-semibold text-cream-100 sm:text-3xl">
              {section.title}
            </h2>
          )}
          {section.description && (
            <p className="max-w-lg text-sm leading-relaxed text-cream-100/80">
              {section.description}
            </p>
          )}
          {section.ctaLabel && section.ctaHref && (
            <ButtonLink href={section.ctaHref} variant="gold" size="md" className="mt-2">
              {section.ctaLabel}
            </ButtonLink>
          )}
        </div>
      </div>
    </section>
  );
}

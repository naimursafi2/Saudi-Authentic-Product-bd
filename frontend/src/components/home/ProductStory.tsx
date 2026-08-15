import Image from "next/image";
import { Sparkles } from "lucide-react";

export function ProductStory() {
  return (
    <section className="relative overflow-hidden bg-cream-100 px-6 py-16 sm:px-12 lg:px-24 lg:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-24 size-[400px] opacity-[0.05]"
      >
        <Sparkles className="size-full text-green-950" strokeWidth={0.5} />
      </div>

      <div className="relative mx-auto grid max-w-[1100px] grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="relative mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-lg border border-gold-500/25 bg-cream-50 shadow-[0_8px_30px_rgba(61,43,31,0.12)]">
          <Image
            src="/images/editorial/mariyam-dates.webp"
            alt="Premium Madinah dates"
            fill
            sizes="(min-width: 1024px) 420px, (min-width: 640px) 60vw, 90vw"
            className="object-cover"
          />
        </div>

        <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
          <Sparkles className="text-gold-500" size={38} strokeWidth={1.25} />
          <h2 className="font-serif text-3xl font-semibold tracking-[-0.02em] text-green-950 sm:text-4xl lg:text-[44px] lg:leading-[52px]">
            The Essence of Madinah
          </h2>
          <p className="text-balance text-base leading-[29px] text-brown-500 sm:text-lg">
            Our journey begins in the sacred orchards of Madinah, where centuries-old
            traditions meet meticulous cultivation. We believe that true luxury lies in
            authenticity. Every product we bring to Bangladesh is a testament to the rich
            heritage of Saudi Arabia, carefully selected to ensure you experience the
            unparalleled quality and spiritual significance woven into each date.
          </p>
          <div className="h-px w-32 bg-green-950 opacity-20" />
        </div>
      </div>
    </section>
  );
}

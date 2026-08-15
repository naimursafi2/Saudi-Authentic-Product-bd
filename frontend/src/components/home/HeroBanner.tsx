import Image from "next/image";
import { ButtonLink } from "@/components/ui/Button";

export function HeroBanner() {
  return (
    <section className="relative flex min-h-[520px] items-center justify-center overflow-hidden bg-cream-400 sm:min-h-[600px] lg:min-h-[720px]">
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 20%, rgba(212,175,55,0.35), transparent 45%), radial-gradient(circle at 85% 15%, rgba(27,67,50,0.3), transparent 45%), radial-gradient(circle at 50% 100%, rgba(112,90,76,0.35), transparent 55%)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cream-100/10 to-cream-100/40" />

      <div className="relative mx-auto flex w-full max-w-[1200px] flex-col items-center gap-10 px-6 py-16 text-center sm:px-12 lg:flex-row lg:gap-16 lg:text-left">
        <div className="flex max-w-xl flex-col items-center gap-6 lg:items-start">
          <h1 className="font-serif text-4xl font-semibold leading-tight tracking-[-0.02em] text-green-950 drop-shadow-sm sm:text-5xl lg:text-[48px] lg:leading-[62px]">
            Authentic Saudi Products
            <br />
            Delivered to Your Doorstep.
          </h1>
          <p className="max-w-xl text-base text-ink-900 sm:text-lg">
            Experience the finest quality dates, exclusive gift boxes, and authentic
            heritage pieces curated for the discerning collector.
          </p>
          <ButtonLink href="/shop" variant="gold" size="lg" className="mt-2">
            Shop Now
          </ButtonLink>
        </div>

        {/* Decorative product photography — mirrors the gold-ringed circular
            frame used by the category tiles so the two sections read as one system. */}
        <div className="flex shrink-0 justify-center lg:ml-auto">
          <span className="relative flex size-[240px] items-center justify-center rounded-full border border-gold-500/40 bg-cream-100/60 p-2.5 shadow-[0_8px_30px_rgba(61,43,31,0.15)] backdrop-blur-sm sm:size-[320px] lg:size-[400px]">
            <span className="relative size-full overflow-hidden rounded-full bg-cream-50">
              <Image
                src="/images/editorial/medjool-dates.webp"
                alt="Premium Saudi dates"
                fill
                sizes="(min-width: 1024px) 400px, (min-width: 640px) 320px, 240px"
                className="object-cover"
                priority
              />
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}

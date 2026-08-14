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
      <div className="relative flex max-w-3xl flex-col items-center gap-6 px-6 py-16 text-center sm:px-12">
        <h1 className="font-serif text-4xl font-semibold leading-tight tracking-[-0.02em] text-green-950 drop-shadow-sm sm:text-5xl lg:text-[48px] lg:leading-[72px]">
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
    </section>
  );
}

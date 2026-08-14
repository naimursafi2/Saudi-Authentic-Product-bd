import type { Metadata } from "next";
import { BadgeCheck, Globe, HandCoins, ShieldCheck } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "Learn about Saudi Authentic Product's mission to bring genuine Saudi and Madinah heritage products to Bangladesh.",
};

const values = [
  {
    icon: BadgeCheck,
    title: "Guaranteed Authenticity",
    description:
      "Every product is sourced directly from certified farms and artisans in Saudi Arabia — no intermediaries, no substitutes.",
  },
  {
    icon: ShieldCheck,
    title: "Rigorous Quality Control",
    description:
      "Each batch is inspected before it leaves the Kingdom and again before it reaches your doorstep in Bangladesh.",
  },
  {
    icon: Globe,
    title: "A Bridge Across Borders",
    description:
      "We built Saudi Authentic Product to make genuine Saudi heritage accessible to every home in Bangladesh.",
  },
  {
    icon: HandCoins,
    title: "Fair, Transparent Pricing",
    description:
      "Premium doesn't have to mean unreasonable. We keep our pricing honest and our packaging worthy of the product inside.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="bg-cream-200 px-6 py-16 sm:px-10 lg:px-16 lg:py-20">
        <div className="mx-auto flex max-w-[820px] flex-col items-center gap-6 text-center">
          <SectionHeading title="Our Story" size="lg" />
          <p className="text-base leading-relaxed text-brown-600 sm:text-lg">
            Saudi Authentic Product was founded with a simple belief: the people of
            Bangladesh deserve access to genuine, unadulterated Saudi heritage — from
            the sacred date orchards of Madinah to the artisans of the Kingdom.
          </p>
          <p className="text-base leading-relaxed text-brown-600 sm:text-lg">
            What began as a small effort to bring premium Ajwa dates home for family
            and friends has grown into a curated marketplace, built on the same
            principle every single day: authenticity first, always.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-6 py-16 sm:px-10 lg:px-16 lg:py-20">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {values.map((value) => (
            <div
              key={value.title}
              className="flex gap-4 rounded-lg border border-gold-500/20 bg-cream-100 p-6 shadow-[0_4px_15px_rgba(61,43,31,0.05)]"
            >
              <value.icon size={26} className="mt-1 shrink-0 text-green-900" strokeWidth={1.5} />
              <div>
                <h3 className="mb-1.5 font-serif text-lg font-semibold text-green-950">
                  {value.title}
                </h3>
                <p className="text-sm leading-relaxed text-brown-500">{value.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-green-900 px-6 py-16 text-center sm:px-10 lg:py-20">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-5">
          <h2 className="font-serif text-3xl font-semibold text-white sm:text-4xl">
            Experience Saudi Heritage, Delivered Home.
          </h2>
          <p className="text-sm text-cream-100/80 sm:text-base">
            Explore our collection of premium dates and gift boxes, curated for the
            discerning collector.
          </p>
          <ButtonLink href="/shop" variant="gold" size="lg">
            Shop Now
          </ButtonLink>
        </div>
      </section>
    </>
  );
}

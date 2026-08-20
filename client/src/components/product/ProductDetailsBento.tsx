import { CheckCircle2, MapPin, RotateCcw, Snowflake, Truck } from "lucide-react";
import Link from "next/link";
import type { Product } from "@/types/product";
import { formatBDT } from "@/lib/utils";
import { SealBadge } from "@/components/ui/SealBadge";

export function ProductDetailsBento({ product }: { product: Product }) {
  return (
    <section className="bg-cream-200 px-6 py-16 sm:px-10 lg:px-16 lg:py-20">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <h2 className="font-serif text-2xl font-semibold text-green-950 sm:text-3xl">
            {product.badge === "Authentic" ? "The Prophet's Choice" : "About this Product"}
          </h2>
          <div className="flex flex-col gap-4 text-base leading-relaxed text-brown-600">
            {product.description.split("\n\n").map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
          <ul className="flex flex-col gap-4 pt-2">
            {product.highlights.map((highlight) => {
              const [title, ...rest] = highlight.split(":");
              return (
                <li key={highlight} className="flex gap-3">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-900" />
                  <p className="text-sm text-brown-600">
                    <span className="font-semibold text-green-950">{title}:</span>
                    {rest.join(":")}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-5">
          <div className="relative flex flex-col gap-3 overflow-hidden rounded-lg bg-brand-deep-2 p-6 text-on-brand">
            <SealBadge
              size={72}
              showRoute={false}
              className="absolute -right-3 -top-3 opacity-90"
            />
            <div className="flex items-center gap-2 pr-14">
              <MapPin size={18} className="text-gold-500" />
              <h3 className="font-serif text-lg font-semibold">Product of Saudi Arabia</h3>
            </div>
            <p className="text-sm leading-relaxed text-on-brand/80">
              Exclusively imported from certified farms in {product.origin}. Each batch
              passes rigorous quality control to ensure you receive only authentic{" "}
              {product.name.split(" ")[0]}.
            </p>
          </div>
          {product.storageInstructions && (
            <div className="flex flex-col gap-3 rounded-lg border border-brown-600/15 bg-cream-300 p-6">
              <div className="flex items-center gap-2">
                <Snowflake size={18} className="text-brown-600" />
                <h3 className="font-serif text-lg font-semibold text-green-950">
                  Storage Instructions
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-brown-600">
                {product.storageInstructions}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-4 rounded-lg border border-brown-600/15 bg-cream-300 p-6">
            <h3 className="font-serif text-lg font-semibold text-green-950">
              Delivery &amp; Returns
            </h3>
            <div className="flex gap-3">
              <Truck size={18} className="mt-0.5 shrink-0 text-green-900" />
              <p className="text-sm leading-relaxed text-brown-600">
                Delivered across Bangladesh in 3–5 business days. Free delivery on orders
                over {formatBDT(5000)}.
              </p>
            </div>
            <div className="flex gap-3">
              <RotateCcw size={18} className="mt-0.5 shrink-0 text-green-900" />
              <p className="text-sm leading-relaxed text-brown-600">
                Unopened items can be returned within 7 days of delivery. See our{" "}
                <Link href="/shipping-policy" className="font-semibold text-green-950 underline">
                  shipping &amp; returns policy
                </Link>{" "}
                for details.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

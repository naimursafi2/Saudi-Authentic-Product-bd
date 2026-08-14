import type { Metadata } from "next";
import Link from "next/link";
import { Percent, ShoppingCart } from "lucide-react";
import { listProducts } from "@/lib/api/products";
import { toProduct } from "@/lib/mappers";
import { formatBDT } from "@/lib/utils";
import { ProductVisual } from "@/components/ui/ProductVisual";
import { ButtonLink } from "@/components/ui/Button";
import { AddToCartButton } from "@/components/shop/AddToCartButton";

export const metadata: Metadata = {
  title: "Special Offers",
  description: "Limited-time offers on authentic Saudi dates and gift boxes.",
};

export const dynamic = "force-dynamic";

export default async function OffersPage() {
  const { data } = await listProducts({ limit: 100 });
  const products = data.products.map(toProduct);

  const deals = products
    .map((product) => {
      const variant = product.variants.find((v) => v.compareAtPriceBDT);
      if (!variant?.compareAtPriceBDT) return null;
      const discount = Math.round(
        ((variant.compareAtPriceBDT - variant.priceBDT) / variant.compareAtPriceBDT) * 100
      );
      return { product, variant, discount };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <>
      <section className="bg-green-900 px-6 py-16 text-center sm:px-10 lg:py-20">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
          <Percent size={32} className="text-gold-500" />
          <h1 className="font-serif text-4xl font-semibold text-white sm:text-5xl">
            Special Offers
          </h1>
          <p className="text-sm text-cream-100/80 sm:text-base">
            Limited-time savings on a selection of our premium Saudi products. New
            offers are added regularly, so check back often.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-6 py-16 sm:px-10 lg:px-16 lg:py-20">
        {deals.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map(({ product, variant, discount }) => (
              <div
                key={product.id}
                className="flex flex-col overflow-hidden rounded-lg border border-gold-500/30 bg-cream-100 shadow-[0_4px_15px_rgba(61,43,31,0.05)]"
              >
                <Link
                  href={`/product/${product.slug}`}
                  className="relative block aspect-[4/5] w-full"
                >
                  <ProductVisual {...product.visual} />
                  <span className="absolute left-4 top-4 rounded-full bg-[#8a4a3f] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white">
                    {discount}% Off
                  </span>
                </Link>
                <div className="flex flex-1 flex-col gap-2 p-6">
                  <Link href={`/product/${product.slug}`}>
                    <h3 className="font-sans text-lg font-semibold text-green-950 hover:text-green-900">
                      {product.name}
                    </h3>
                  </Link>
                  <p className="line-clamp-2 text-sm text-brown-500">{product.tagline}</p>
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <span className="flex items-baseline gap-2">
                      <span className="text-lg font-semibold text-green-950">
                        {formatBDT(variant.priceBDT)}
                      </span>
                      <span className="text-sm text-brown-500/60 line-through">
                        {formatBDT(variant.compareAtPriceBDT!)}
                      </span>
                    </span>
                    <AddToCartButton productId={product.id} variantId={variant.id} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-brown-500">
            No active offers right now — check back soon.
          </p>
        )}

        <div className="mt-16 flex flex-col items-center gap-3 rounded-lg border border-dashed border-gold-500/40 bg-cream-200 p-10 text-center">
          <ShoppingCart size={26} className="text-brown-500" />
          <h2 className="font-serif text-xl text-green-950">More Offers Coming Soon</h2>
          <p className="max-w-md text-sm text-brown-500">
            Seasonal bundles across Perfumes, Heritage Watches, Chocolates and Nuts are
            on the way as we expand beyond dates.
          </p>
          <ButtonLink href="/shop" variant="outline" size="sm" className="mt-1">
            Browse All Products
          </ButtonLink>
        </div>
      </section>
    </>
  );
}

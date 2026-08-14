import Link from "next/link";
import { listProducts } from "@/lib/api/products";
import { toProduct } from "@/lib/mappers";
import { ProductCard } from "@/components/ui/ProductCard";
import { SectionHeading } from "@/components/ui/SectionHeading";

export async function BestSellers() {
  const { data } = await listProducts({ isBestSeller: true, limit: 3, sort: "featured" });
  const bestSellers = data.products.map(toProduct);

  if (bestSellers.length === 0) return null;

  return (
    <section className="bg-cream-200 px-6 py-16 sm:px-10 lg:px-16 lg:py-20">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-12">
        <div className="flex items-end justify-between gap-4">
          <SectionHeading title="Best Sellers" align="left" dividerWidth={64} />
          <Link
            href="/shop"
            className="flex shrink-0 items-center gap-1 text-xs font-bold uppercase tracking-[0.1em] text-brown-600 hover:text-green-950"
          >
            View All <span aria-hidden>&rarr;</span>
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {bestSellers.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}

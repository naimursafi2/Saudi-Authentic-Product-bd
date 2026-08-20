import Link from "next/link";
import { listProducts } from "@/lib/api/products";
import { toProduct } from "@/lib/mappers";
import { getProductDeals } from "@/lib/productOffers";
import { ProductCard } from "@/components/ui/ProductCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn, PRODUCT_GRID_CLASS } from "@/lib/utils";
import type { ApiHomepageSection } from "@/types/api";
import type { Product } from "@/types/product";

const DEFAULT_LIMIT = 10;

const DEFAULT_CTA: Record<string, { label: string; href: string }> = {
  bestSellers: { label: "View All", href: "/shop" },
  newArrivals: { label: "Shop New Arrivals", href: "/shop" },
  onSale: { label: "View All Offers", href: "/offers" },
};

async function resolveProducts(section: ApiHomepageSection, limit: number): Promise<Product[]> {
  const mode = section.productMode ?? "category";

  if (mode === "bestSellers") {
    const { data } = await listProducts({ isBestSeller: true, limit, sort: "featured" });
    return data.products.map(toProduct);
  }

  if (mode === "newArrivals") {
    const { data } = await listProducts({ sort: "newest", limit });
    return data.products.map(toProduct);
  }

  if (mode === "onSale") {
    const { data } = await listProducts({ limit: 100 });
    return getProductDeals(data.products.map(toProduct))
      .slice(0, limit)
      .map((deal) => deal.product);
  }

  // "category" mode
  if (!section.categorySlug) return [];
  const { data } = await listProducts({ category: section.categorySlug, limit, sort: "featured" });
  return data.products.map(toProduct);
}

export async function ProductShowcase({ section }: { section: ApiHomepageSection }) {
  const limit = section.limit ?? DEFAULT_LIMIT;
  const products = await resolveProducts(section, limit);

  if (products.length === 0) return null;

  const mode = section.productMode ?? "category";
  const fallbackCta =
    mode === "category" && section.categorySlug
      ? { label: "Shop All", href: `/shop?category=${section.categorySlug}` }
      : DEFAULT_CTA[mode];
  const ctaLabel = section.ctaLabel || fallbackCta?.label;
  const ctaHref = section.ctaHref || fallbackCta?.href;

  const tinted = section.sortOrder % 2 === 0;

  return (
    <section className={cn("px-6 py-16 sm:px-10 lg:px-16 lg:py-20", tinted && "bg-cream-200")}>
      <div className="mx-auto flex max-w-[1200px] flex-col gap-12">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-2">
            <SectionHeading title={section.title || "Featured Products"} align="left" dividerWidth={64} />
            {section.subtitle && <p className="max-w-2xl text-sm text-brown-600 sm:text-base">{section.subtitle}</p>}
          </div>
          {ctaLabel && ctaHref && (
            <Link
              href={ctaHref}
              className="flex shrink-0 items-center gap-1 text-xs font-bold uppercase tracking-[0.1em] text-brown-600 hover:text-green-950"
            >
              {ctaLabel} <span aria-hidden>&rarr;</span>
            </Link>
          )}
        </div>
        <div className={PRODUCT_GRID_CLASS}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import { PRODUCT_GRID_CLASS } from "@/lib/utils";
import { useRecentlyViewed } from "@/context/RecentlyViewedContext";
import { ProductCard } from "@/components/ui/ProductCard";
import { SectionHeading } from "@/components/ui/SectionHeading";

/** Excludes `excludeProductId` (the product page this rail sits on) so a product never lists itself. */
export function RecentlyViewed({ excludeProductId }: { excludeProductId?: string }) {
  const { items, isLoading } = useRecentlyViewed();
  const products = items.filter((p) => p.id !== excludeProductId);

  if (isLoading || products.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-16 sm:px-10 lg:px-16 lg:py-20">
      <div className="flex flex-col gap-12">
        <SectionHeading title="Recently Viewed" dividerWidth={64} />
        <div className={PRODUCT_GRID_CLASS}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}

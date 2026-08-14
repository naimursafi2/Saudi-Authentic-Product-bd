import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { listCategories } from "@/lib/api/categories";
import { listProducts } from "@/lib/api/products";
import { toCategory, toProduct } from "@/lib/mappers";
import { ProductVisual } from "@/components/ui/ProductVisual";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Shop by Category",
  description:
    "Browse Saudi Authentic Product categories — from premium Madinah dates to gift boxes, with more heritage categories coming soon.",
};

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const [{ data: categoryData }, { data: productData }] = await Promise.all([
    listCategories(),
    listProducts({ limit: 100 }),
  ]);
  const allCategories = categoryData.categories.map(toCategory);
  const products = productData.products.map(toProduct);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-14 sm:px-10 lg:px-16">
      <div className="mb-12 flex flex-col items-center gap-3 text-center">
        <SectionHeading title="Shop by Category" />
        <p className="max-w-xl text-sm text-brown-500">
          From premium Madinah dates to curated gift boxes — with perfumes, heritage
          watches, chocolates and nuts on the way.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {allCategories.map((category) => {
          const count = products.filter((p) =>
            p.categories.some((c) => c.slug === category.slug)
          ).length;

          const content = (
            <>
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                {category.image ? (
                  <Image
                    src={category.image.url}
                    alt={category.name}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className={cn("object-cover", category.comingSoon && "saturate-0")}
                  />
                ) : (
                  <ProductVisual
                    {...category.visual}
                    className={cn(category.comingSoon && "saturate-0")}
                  />
                )}
                {category.comingSoon && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/15 backdrop-blur-[1px]">
                    <span className="rounded-full border border-black/10 bg-cream-200/90 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-brown-500">
                      Coming Soon
                    </span>
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1 p-5">
                <h3 className="font-serif text-xl font-semibold text-green-950">
                  {category.name}
                </h3>
                <p className="text-sm text-brown-500">{category.description}</p>
                {!category.comingSoon && (
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.08em] text-green-900">
                    {count} {count === 1 ? "Product" : "Products"}
                  </p>
                )}
              </div>
            </>
          );

          return category.comingSoon ? (
            <div
              key={category.slug}
              className="flex flex-col overflow-hidden rounded-lg border border-gold-500/20 bg-cream-100 opacity-90 shadow-[0_4px_15px_rgba(61,43,31,0.05)]"
            >
              {content}
            </div>
          ) : (
            <Link
              key={category.slug}
              href={`/shop?category=${category.slug}`}
              className="group flex flex-col overflow-hidden rounded-lg border border-gold-500/30 bg-cream-100 shadow-[0_4px_15px_rgba(61,43,31,0.05)] transition-shadow hover:shadow-[0_8px_24px_rgba(61,43,31,0.1)]"
            >
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

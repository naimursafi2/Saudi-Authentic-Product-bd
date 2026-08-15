import Link from "next/link";
import { listCategories } from "@/lib/api/categories";
import { toCategory } from "@/lib/mappers";
import { ProductMedia } from "@/components/ui/ProductMedia";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/lib/utils";
import type { ApiHomepageSection } from "@/types/api";

export async function FeaturedCategories({ section }: { section?: ApiHomepageSection }) {
  const { data } = await listCategories();
  const featured = data.categories
    .map(toCategory)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 4);

  if (featured.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-16 sm:px-10 lg:px-16 lg:py-20">
      <div className="flex flex-col items-center gap-12">
        <SectionHeading title={section?.title || "Explore Our Collections"} />
        <div className="grid w-full grid-cols-2 gap-8 sm:grid-cols-4 sm:gap-6">
          {featured.map((category) => (
            <Link
              key={category.slug}
              href={
                category.comingSoon
                  ? "/categories"
                  : `/shop?category=${category.slug}`
              }
              className={cn(
                "group flex flex-col items-center gap-4 text-center",
                category.comingSoon && "opacity-80"
              )}
            >
              <span className="relative flex size-[140px] items-center justify-center rounded-full border border-gold-500/30 p-[9px] shadow-[0_4px_20px_rgba(61,43,31,0.08)] sm:size-[192px]">
                <span className="relative size-full overflow-hidden rounded-full">
                  <ProductMedia
                    src={category.image?.url}
                    fallbackPhoto={category.fallbackPhoto}
                    visual={category.visual}
                    alt={category.name}
                    sizes="(min-width: 640px) 192px, 140px"
                    className={cn(
                      "transition-transform duration-500 group-hover:scale-105",
                      category.comingSoon && "saturate-0"
                    )}
                  />
                  {category.comingSoon && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
                      <span className="rounded-full border border-black/10 bg-cream-200/90 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-brown-500 sm:text-xs">
                        Coming Soon
                      </span>
                    </span>
                  )}
                </span>
              </span>
              <span
                className={cn(
                  "text-base font-semibold sm:text-xl",
                  category.comingSoon ? "text-brown-500" : "text-green-950"
                )}
              >
                {category.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

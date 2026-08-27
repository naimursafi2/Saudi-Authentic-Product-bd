import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/api/products";
import { ApiClientError } from "@/lib/api/client";
import { toProduct } from "@/lib/mappers";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { ProductDetailsBento } from "@/components/product/ProductDetailsBento";
import { ProductReviews } from "@/components/product/ProductReviews";
import { RelatedProducts } from "@/components/product/RelatedProducts";
import { RecentlyViewed } from "@/components/product/RecentlyViewed";
import { RecentlyViewedRecorder } from "@/components/product/RecentlyViewedRecorder";

// The catalog is managed live via the admin portal, so this page is always
// rendered dynamically against the current database state.
export const dynamic = "force-dynamic";

async function loadProduct(slug: string) {
  try {
    const { data } = await getProductBySlug(slug);
    return { product: toProduct(data.product), related: data.related.map(toProduct) };
  } catch (err) {
    if (err instanceof ApiClientError && err.statusCode === 404) return null;
    throw err;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadProduct(slug);
  if (!result) return {};
  return {
    title: result.product.name,
    description: result.product.tagline,
  };
}

export default async function ProductDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await loadProduct(slug);
  if (!result) notFound();
  const { product, related } = result;

  return (
    <>
      <RecentlyViewedRecorder productId={product.id} />
      <section className="mx-auto max-w-[1200px] px-6 py-10 sm:px-10 lg:px-16 lg:py-14">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <ProductGallery product={product} />
          <ProductInfo product={product} />
        </div>
      </section>
      <ProductDetailsBento product={product} />
      <RelatedProducts products={related} />
      <RecentlyViewed excludeProductId={product.id} />
      {/* Reviews is deliberately the last section on the page, immediately
          before the storefront Footer the (site) layout renders next. */}
      <ProductReviews productId={product.id} />
    </>
  );
}

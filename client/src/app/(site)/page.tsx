import { HeroBanner } from "@/components/home/HeroBanner";
import { TrustStrip } from "@/components/home/TrustStrip";
import { FeaturedCategories } from "@/components/home/FeaturedCategories";
import { BestSellers } from "@/components/home/BestSellers";
import { ProductStory } from "@/components/home/ProductStory";
import { CustomerReviews } from "@/components/home/CustomerReviews";
import { PromoBanner } from "@/components/home/PromoBanner";
import { ProductShowcase } from "@/components/home/ProductShowcase";
import { listHomepageSections } from "@/lib/api/homepageSections";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Section order, visibility, and content are managed from the admin
  // portal (Admin > Homepage) — this renders whatever's currently visible,
  // in the order the admin set, with no code changes required.
  const { data } = await listHomepageSections();

  return (
    <>
      {data.sections.map((section) => {
        switch (section.type) {
          case "hero":
            return <HeroBanner key={section._id} section={section} />;
          case "trustStrip":
            return <TrustStrip key={section._id} section={section} />;
          case "featuredCategories":
            return <FeaturedCategories key={section._id} section={section} />;
          case "bestSellers":
            return <BestSellers key={section._id} section={section} />;
          case "productStory":
            return <ProductStory key={section._id} section={section} />;
          case "customerReviews":
            return <CustomerReviews key={section._id} section={section} />;
          case "promoBanner":
            return <PromoBanner key={section._id} section={section} />;
          case "productShowcase":
            return <ProductShowcase key={section._id} section={section} />;
          default:
            // Includes `banner`-type sections — the homepage no longer
            // renders the two-up banner carousel (it duplicated the hero
            // carousel's images); the `HomepageSection` type/admin CRUD at
            // /admin/homepage still exists, just unrendered here.
            return null;
        }
      })}
    </>
  );
}

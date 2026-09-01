import { HeroBanner } from "@/components/home/HeroBanner";
import { TrustStrip } from "@/components/home/TrustStrip";
import { FeaturedCategories } from "@/components/home/FeaturedCategories";
import { BestSellers } from "@/components/home/BestSellers";
import { ProductStory } from "@/components/home/ProductStory";
import { CustomerReviews } from "@/components/home/CustomerReviews";
import { PromoBanner } from "@/components/home/PromoBanner";
import { ProductShowcase } from "@/components/home/ProductShowcase";
import { listHomepageSections } from "@/lib/api/homepageSections";

// No `force-dynamic` here — the shared (site) layout's `connection()` call
// already forces this whole route group to render per-request (see
// `(site)/layout.tsx` for why: prerendering at build time against a
// cold-sleeping Render backend fails the Vercel build). `force-dynamic`
// would additionally force every fetch below to `no-store`, which is what
// made Home re-fetch and re-render from scratch on every single visit —
// the `revalidate` window below is the whole point of removing it.
export default async function HomePage() {
  // Section order, visibility, and content are managed from the admin
  // portal (Admin > Homepage) — this renders whatever's currently visible,
  // in the order the admin set, with no code changes required. 60s cache:
  // an admin change shows up within a minute instead of needing every
  // visitor to hit the backend fresh.
  const { data } = await listHomepageSections(false, 60);

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

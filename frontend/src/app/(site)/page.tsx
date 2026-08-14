import { HeroBanner } from "@/components/home/HeroBanner";
import { FeaturedCategories } from "@/components/home/FeaturedCategories";
import { BestSellers } from "@/components/home/BestSellers";
import { ProductStory } from "@/components/home/ProductStory";
import { CustomerReviews } from "@/components/home/CustomerReviews";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <>
      <HeroBanner />
      <FeaturedCategories />
      <BestSellers />
      <ProductStory />
      <CustomerReviews />
    </>
  );
}

import { Suspense } from "react";
import type { Metadata } from "next";
import { ShopPageClient } from "@/components/shop/ShopPageClient";

export const metadata: Metadata = {
  title: "Shop Authentic Saudi Dates & Gift Boxes",
  description:
    "Browse premium Saudi & Madinah dates and gift boxes, filterable by category, price and rating.",
};

export default function ShopPage() {
  return (
    <Suspense fallback={null}>
      <ShopPageClient />
    </Suspense>
  );
}

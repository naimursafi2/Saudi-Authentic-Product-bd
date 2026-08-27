"use client";

import { useEffect } from "react";
import { useRecentlyViewed } from "@/context/RecentlyViewedContext";

/** Records a product-page view into localStorage — renders nothing itself, just the side effect. */
export function RecentlyViewedRecorder({ productId }: { productId: string }) {
  const { recordView } = useRecentlyViewed();

  useEffect(() => {
    recordView(productId);
  }, [productId, recordView]);

  return null;
}

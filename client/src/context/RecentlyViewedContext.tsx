"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useProductsByIds } from "@/lib/hooks/useProductsByIds";
import type { Product } from "@/types/product";

const STORAGE_KEY = "sap:recently-viewed";
const MAX_ITEMS = 10;

interface RecentlyViewedContextValue {
  productIds: string[];
  items: Product[];
  isLoading: boolean;
  recordView: (productId: string) => void;
}

const RecentlyViewedContext = createContext<RecentlyViewedContextValue | null>(null);

/**
 * Client-side only, like Wishlist/Cart — no server-side "recently viewed"
 * model. Most-recently-viewed first, deduped (re-viewing a product moves it
 * back to the front rather than adding a second entry), capped at
 * `MAX_ITEMS` so the list can't grow without bound.
 */
export function RecentlyViewedProvider({ children }: { children: React.ReactNode }) {
  const [productIds, setProductIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setProductIds(JSON.parse(raw));
    } catch {
      // ignore malformed storage
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(productIds));
  }, [productIds, hydrated]);

  const recordView = useCallback((productId: string) => {
    setProductIds((prev) => [productId, ...prev.filter((id) => id !== productId)].slice(0, MAX_ITEMS));
  }, []);

  const { productsById, isLoading } = useProductsByIds(productIds);

  const items = useMemo(
    () => productIds.map((id) => productsById[id]).filter((p): p is Product => !!p),
    [productIds, productsById]
  );

  const value: RecentlyViewedContextValue = { productIds, items, isLoading, recordView };

  return <RecentlyViewedContext.Provider value={value}>{children}</RecentlyViewedContext.Provider>;
}

export function useRecentlyViewed() {
  const ctx = useContext(RecentlyViewedContext);
  if (!ctx) throw new Error("useRecentlyViewed must be used within a RecentlyViewedProvider");
  return ctx;
}

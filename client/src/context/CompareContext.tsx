"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useProductsByIds } from "@/lib/hooks/useProductsByIds";
import type { Product } from "@/types/product";

const STORAGE_KEY = "sap:compare";
const MAX_ITEMS = 4;

interface CompareContextValue {
  productIds: string[];
  items: Product[];
  isLoading: boolean;
  isComparing: (productId: string) => boolean;
  toggleCompare: (productId: string) => void;
  removeFromCompare: (productId: string) => void;
  clearCompare: () => void;
}

const CompareContext = createContext<CompareContextValue | null>(null);

/**
 * Product Comparison — client-side only, same shape as Wishlist/Recently
 * Viewed (no server-side model). Capped at `MAX_ITEMS`: toggling a 5th
 * product on is a no-op rather than silently evicting an earlier pick, so
 * the customer isn't surprised by which products ended up on the comparison.
 */
export function CompareProvider({ children }: { children: React.ReactNode }) {
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

  const toggleCompare = useCallback((productId: string) => {
    setProductIds((prev) => {
      if (prev.includes(productId)) return prev.filter((id) => id !== productId);
      if (prev.length >= MAX_ITEMS) return prev;
      return [...prev, productId];
    });
  }, []);

  const removeFromCompare = useCallback((productId: string) => {
    setProductIds((prev) => prev.filter((id) => id !== productId));
  }, []);

  const clearCompare = useCallback(() => setProductIds([]), []);

  const isComparing = useCallback((productId: string) => productIds.includes(productId), [productIds]);

  const { productsById, isLoading } = useProductsByIds(productIds);

  const items = useMemo(
    () => productIds.map((id) => productsById[id]).filter((p): p is Product => !!p),
    [productIds, productsById]
  );

  const value: CompareContextValue = {
    productIds,
    items,
    isLoading,
    isComparing,
    toggleCompare,
    removeFromCompare,
    clearCompare,
  };

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare must be used within a CompareProvider");
  return ctx;
}

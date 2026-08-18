"use client";

import { useEffect, useRef, useState } from "react";
import { listProducts } from "@/lib/api/products";
import { toProduct } from "@/lib/mappers";
import type { Product } from "@/types/product";

/**
 * Resolves a list of product ids (as stored in the cart/wishlist
 * localStorage) into full `Product` objects from the API, keyed by id.
 * Re-fetches only when the set of ids actually changes.
 */
export function useProductsByIds(ids: string[]) {
  const [productsById, setProductsById] = useState<Record<string, Product>>({});
  const [isLoading, setIsLoading] = useState(false);
  const lastKey = useRef<string>("");

  const key = [...new Set(ids)].sort().join(",");

  useEffect(() => {
    if (key === lastKey.current) return;
    lastKey.current = key;

    if (!key) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProductsById({});
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    listProducts({ ids: key.split(","), limit: 100 })
      .then(({ data }) => {
        if (cancelled) return;
        const map: Record<string, Product> = {};
        for (const apiProduct of data.products) {
          map[apiProduct._id] = toProduct(apiProduct);
        }
        setProductsById(map);
      })
      .catch(() => {
        if (!cancelled) setProductsById({});
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return { productsById, isLoading };
}

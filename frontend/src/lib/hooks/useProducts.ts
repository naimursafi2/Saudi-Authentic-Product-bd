"use client";

import { useEffect, useState } from "react";
import { listProducts, type ListProductsParams } from "@/lib/api/products";
import { toProduct } from "@/lib/mappers";
import type { Product } from "@/types/product";
import type { Pagination } from "@/types/api";

/**
 * Fetches the product catalog once on mount (params are read only at mount
 * time — the storefront's filter/sort/paginate UX operates client-side on
 * the full result set, matching the existing ShopPageClient design).
 */
export function useProducts(params: ListProductsParams = {}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    listProducts(params)
      .then(({ data, pagination: pg }) => {
        if (cancelled) return;
        setProducts(data.products.map(toProduct));
        setPagination(pg ?? null);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load products.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { products, pagination, isLoading, error };
}

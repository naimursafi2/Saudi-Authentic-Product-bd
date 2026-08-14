"use client";

import { useEffect, useState } from "react";
import { listCategories } from "@/lib/api/categories";
import { toCategory } from "@/lib/mappers";
import type { Category } from "@/types/product";

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    listCategories()
      .then(({ data }) => {
        if (cancelled) return;
        setCategories(data.categories.map(toCategory).sort((a, b) => a.sortOrder - b.sortOrder));
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load categories.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, isLoading, error };
}

import { useEffect, useRef, useState } from "react";
import { listProducts } from "@/lib/api/products";
import { toProduct } from "@/lib/mappers";
import { rankProductMatches } from "@/lib/searchRanking";
import type { Product } from "@/types/product";

const SEARCH_DEBOUNCE_MS = 320;
const SEARCH_RESULT_LIMIT = 100;

/**
 * Shared live-search behind both the desktop `HeaderSearchBar` dropdown and
 * the mobile/compact `SearchOverlay` — one debounced fetch against the real
 * `/products?q=` endpoint, ranked client-side, with stale-response guarding
 * so a slow earlier keystroke can never clobber a later one's results.
 */
export function useProductSearchSuggestions(query: string) {
  const [results, setResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      setIsSearching(false);
      requestIdRef.current += 1;
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsSearching(true);

    const t = window.setTimeout(() => {
      listProducts({ q, limit: SEARCH_RESULT_LIMIT })
        .then(({ data }) => {
          if (requestIdRef.current !== requestId) return;
          const products = data.products.map(toProduct);
          setResults(rankProductMatches(products, q));
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) return;
          setResults([]);
        })
        .finally(() => {
          if (requestIdRef.current !== requestId) return;
          setIsSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(t);
    };
  }, [query]);

  return { results, isSearching };
}

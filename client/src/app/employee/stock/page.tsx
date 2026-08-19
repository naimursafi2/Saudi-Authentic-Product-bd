"use client";

import { useEffect, useState } from "react";
import { Boxes, Search } from "lucide-react";
import { listStockLevels } from "@/lib/api/inventory";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import type { StockLevelProduct } from "@/types/hr";

/**
 * Read-only view of the live catalogue stock, for warehouse/stock-checking
 * work. Employees can see the real number but cannot change it — adjustments
 * are admin-tier and additionally require Super Admin approval.
 */
export default function EmployeeStockPage() {
  const [products, setProducts] = useState<StockLevelProduct[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    listStockLevels(debouncedSearch || undefined)
      .then(({ data }) => {
        setProducts(data.products);
        setError(null);
      })
      .catch(() => setError("Could not load stock levels."))
      .finally(() => setIsLoading(false));
  }, [debouncedSearch]);

  return (
    <div>
      <PageHeader
        title="Stock Levels"
        description="Live stock for every product. View only — adjustments are made by an administrator."
      />

      <div className="mb-4 relative w-full max-w-xs">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brown-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="h-9 w-full rounded border border-brown-600/20 bg-white pl-8 pr-3 text-sm text-green-950 placeholder:text-brown-500/60 focus:outline-none focus:ring-1 focus:ring-green-900/30"
        />
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : products.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No products found"
          description={debouncedSearch ? "Try a different search term." : "The catalogue is empty."}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Variant</th>
                <th className="px-4 py-3">In Stock</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) =>
                product.variants.map((variant, index) => (
                  <tr
                    key={`${product._id}-${variant.variantId}`}
                    className="border-b border-brown-600/10 last:border-none"
                  >
                    <td className="px-4 py-3 font-medium text-green-950">
                      {index === 0 ? product.name : ""}
                    </td>
                    <td className="px-4 py-3 text-brown-600">{variant.label}</td>
                    <td className="px-4 py-3">
                      {variant.stock === 0 ? (
                        <span className="rounded-full bg-brown-600 px-2.5 py-0.5 text-[11px] font-bold uppercase text-white">
                          Stock Out
                        </span>
                      ) : (
                        <span
                          className={
                            variant.stock <= variant.lowStockThreshold
                              ? "font-semibold text-[#8a4a3f]"
                              : "text-brown-600"
                          }
                        >
                          {variant.stock}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { api } from "./client";
import type { ApiInventoryLog, LowStockEntry, StockLevelProduct } from "@/types/hr";

/** Applies immediately only for `super_admin`; every other role gets back a
 * `pendingActionId` and the live stock is unchanged until a Super Admin
 * grants it at `/admin/approvals`. */
export async function adjustStock(payload: { productId: string; variantId: string; delta: number; note?: string }) {
  return api.post<{ pendingActionId?: string } | null>("/inventory/adjust", payload);
}

/** Live per-variant stock straight from the catalogue — the same numbers the
 * storefront renders. Readable by employees, not just admin-tier roles. */
export async function listStockLevels(search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return api.get<{ products: StockLevelProduct[] }>(`/inventory/stock${qs}`);
}

export async function listInventoryLogs(params: { product?: string; page?: number; limit?: number } = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return api.get<{ logs: ApiInventoryLog[] }>(`/inventory/logs${qs ? `?${qs}` : ""}`);
}

export async function listLowStockProducts() {
  return api.get<{ products: LowStockEntry[] }>("/inventory/low-stock");
}

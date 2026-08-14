import { api } from "./client";
import type { ApiInventoryLog, LowStockEntry } from "@/types/hr";
import type { ApiProduct } from "@/types/api";

export async function adjustStock(payload: { productId: string; variantId: string; delta: number; note?: string }) {
  return api.post<{ product: ApiProduct }>("/inventory/adjust", payload);
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

import { api } from "./client";
import type { ApiShop, ApiUserShopAssignment } from "@/types/api";

export interface ShopPayload {
  name: string;
  code: string;
  location?: string;
  note?: string;
  isActive?: boolean;
}

export async function listShops(params: { includeInactive?: boolean } = {}) {
  const qs = params.includeInactive ? "?includeInactive=true" : "";
  return api.get<{ shops: ApiShop[] }>(`/shops${qs}`);
}

export async function createShop(payload: ShopPayload) {
  return api.post<{ shop: ApiShop }>("/shops", payload);
}

export async function updateShop(id: string, payload: Partial<ShopPayload>) {
  return api.patch<{ shop: ApiShop }>(`/shops/${id}`, payload);
}

export async function deleteShop(id: string) {
  return api.delete<null>(`/shops/${id}`);
}

export async function getUserShops(userId: string) {
  return api.get<{ user: ApiUserShopAssignment }>(`/shops/users/${userId}`);
}

export async function assignShops(userId: string, shopIds: string[]) {
  return api.patch<{ user: ApiUserShopAssignment }>(`/shops/users/${userId}`, { shopIds });
}

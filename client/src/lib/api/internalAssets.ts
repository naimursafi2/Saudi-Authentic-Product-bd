import { api } from "./client";
import type { ApiInternalAsset, InternalAssetKind, InternalAssetStatus, Role } from "@/types/api";

export interface ListInternalAssetsParams {
  status?: InternalAssetStatus;
  kind?: InternalAssetKind;
  uploadedBy?: string;
  role?: Role;
  resource?: string;
  module?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

/** Super Admin's centralized view of every internal upload. Requires `assets.manage`. */
export async function listInternalAssets(params: ListInternalAssetsParams = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== null) search.set(key, String(value));
  }
  const qs = search.toString();
  return api.get<{ assets: ApiInternalAsset[] }>(`/internal-assets${qs ? `?${qs}` : ""}`);
}

export async function getInternalAsset(id: string) {
  return api.get<{ asset: ApiInternalAsset }>(`/internal-assets/${id}`);
}

/** Staff ask for one of their own uploads to be removed; nothing is deleted here. */
export async function requestAssetDeletion(id: string, reason?: string) {
  return api.post<{ asset: ApiInternalAsset }>(`/internal-assets/${id}/request-delete`, { reason });
}

export async function approveAssetDeletion(id: string, reviewNote?: string) {
  return api.patch<{ asset: ApiInternalAsset }>(`/internal-assets/${id}/approve`, { reviewNote });
}

export async function rejectAssetDeletion(id: string, reviewNote?: string) {
  return api.patch<{ asset: ApiInternalAsset }>(`/internal-assets/${id}/reject`, { reviewNote });
}

export async function restoreAsset(id: string) {
  return api.patch<{ asset: ApiInternalAsset }>(`/internal-assets/${id}/restore`, {});
}

/**
 * Irreversible. The API requires `confirm: true`, so this can never fire from
 * a stray click — the UI asks for a typed confirmation first.
 */
export async function purgeAssetNow(id: string, reason?: string) {
  return api.post<{ asset: ApiInternalAsset }>(`/internal-assets/${id}/purge`, {
    confirm: true,
    reason,
  });
}

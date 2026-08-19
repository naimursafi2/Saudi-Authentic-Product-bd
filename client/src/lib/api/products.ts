import { api } from "./client";
import type { ApiProduct } from "@/types/api";

export interface ListProductsParams {
  q?: string;
  category?: string;
  ids?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  isBestSeller?: boolean;
  isFeatured?: boolean;
  sort?: "featured" | "price-asc" | "price-desc" | "rating" | "newest";
  page?: number;
  limit?: number;
}

function toQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function listProducts(params: ListProductsParams = {}) {
  const qs = toQueryString({
    q: params.q,
    category: params.category,
    ids: params.ids?.join(","),
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    minRating: params.minRating,
    isBestSeller: params.isBestSeller,
    isFeatured: params.isFeatured,
    sort: params.sort,
    page: params.page,
    limit: params.limit,
  });
  return api.get<{ products: ApiProduct[] }>(`/products${qs}`);
}

export async function getProductBySlug(slug: string) {
  return api.get<{ product: ApiProduct; related: ApiProduct[] }>(`/products/${slug}`);
}

export async function getProductByIdForAdmin(id: string) {
  return api.get<{ product: ApiProduct }>(`/products/admin/${id}`);
}

/** Content applies immediately; `stockPendingActionId` comes back when the
 * submitted stock quantities were queued for Super Admin approval instead
 * (everyone but `super_admin` — see `/admin/approvals`). */
export async function createProduct(formData: FormData) {
  return api.postForm<{ product: ApiProduct; stockPendingActionId?: string }>("/products", formData);
}

export async function updateProduct(id: string, formData: FormData) {
  return api.patchForm<{ product: ApiProduct; stockPendingActionId?: string }>(
    `/products/${id}`,
    formData
  );
}

/** `super_admin` deletes directly; `co_admin`'s request comes back as a
 * pending approval instead (see ROLES_AND_PERMISSIONS_v2.md §6, `/admin/approvals`). */
export async function deleteProduct(id: string) {
  return api.delete<{ pendingActionId?: string } | null>(`/products/${id}`);
}

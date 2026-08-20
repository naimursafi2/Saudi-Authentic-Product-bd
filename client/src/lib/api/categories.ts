import { api } from "./client";
import type { ApiCategory } from "@/types/api";

/**
 * `revalidate` (seconds) opts this GET into a short Next.js data-cache
 * window instead of the default no-store — pass it from server components
 * rendering site chrome (nav, header) where a brief staleness on category
 * changes is an acceptable trade for cutting the round trip.
 */
export async function listCategories(includeInactive = false, revalidate?: number) {
  const qs = includeInactive ? "?includeInactive=true" : "";
  return api.get<{ categories: ApiCategory[] }>(`/categories${qs}`, { revalidate });
}

export async function getCategoryBySlug(slug: string) {
  return api.get<{ category: ApiCategory }>(`/categories/${slug}`);
}

export async function createCategory(formData: FormData) {
  return api.postForm<{ category: ApiCategory }>("/categories", formData);
}

export async function updateCategory(id: string, formData: FormData) {
  return api.patchForm<{ category: ApiCategory }>(`/categories/${id}`, formData);
}

export async function deleteCategory(id: string) {
  return api.delete<null>(`/categories/${id}`);
}

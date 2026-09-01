import { api } from "./client";
import type { ApiCategory } from "@/types/api";

/**
 * `revalidate` (seconds) opts this GET into Next.js data caching instead of
 * the default no-store — pass it from server components rendering site
 * chrome (nav, header). Tagged "categories" so the admin portal's category
 * create/update/delete can bust this instantly via `/api/revalidate`
 * instead of visitors waiting out `revalidate`.
 */
export async function listCategories(includeInactive = false, revalidate?: number) {
  const qs = includeInactive ? "?includeInactive=true" : "";
  return api.get<{ categories: ApiCategory[] }>(`/categories${qs}`, { revalidate, tags: ["categories"] });
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

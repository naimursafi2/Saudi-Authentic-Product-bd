import { api } from "./client";
import type { ApiCategory } from "@/types/api";

export async function listCategories(includeInactive = false) {
  const qs = includeInactive ? "?includeInactive=true" : "";
  return api.get<{ categories: ApiCategory[] }>(`/categories${qs}`);
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

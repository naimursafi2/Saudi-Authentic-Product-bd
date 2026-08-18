import { api } from "./client";
import type { ApiHomepageSection } from "@/types/api";

export async function listHomepageSections(includeHidden = false) {
  const qs = includeHidden ? "?includeHidden=true" : "";
  return api.get<{ sections: ApiHomepageSection[] }>(`/homepage-sections${qs}`);
}

export async function createHomepageSection(formData: FormData) {
  return api.postForm<{ section: ApiHomepageSection }>("/homepage-sections", formData);
}

export async function updateHomepageSection(id: string, formData: FormData) {
  return api.patchForm<{ section: ApiHomepageSection }>(`/homepage-sections/${id}`, formData);
}

export async function deleteHomepageSection(id: string) {
  return api.delete<null>(`/homepage-sections/${id}`);
}

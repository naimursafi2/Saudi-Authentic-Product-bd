import { api } from "./client";
import type { ApiHomepageSection } from "@/types/api";

/**
 * `revalidate` (seconds) opts this GET into a short Next.js data-cache
 * window instead of the default no-store — see `categories.ts`'s
 * `listCategories` for why: same trade-off, same site-chrome-style content.
 */
export async function listHomepageSections(includeHidden = false, revalidate?: number) {
  const qs = includeHidden ? "?includeHidden=true" : "";
  return api.get<{ sections: ApiHomepageSection[] }>(`/homepage-sections${qs}`, { revalidate });
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

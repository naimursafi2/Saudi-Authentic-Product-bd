import { api } from "./client";
import type { ApiHomepageSection } from "@/types/api";

/**
 * `revalidate` (seconds) opts this GET into Next.js data caching instead of
 * the default no-store — see `categories.ts`'s `listCategories` for why:
 * same trade-off, same site-chrome-style content. Tagged "homepage-sections"
 * so the admin portal's section create/update/delete can bust this
 * instantly via `/api/revalidate`.
 */
export async function listHomepageSections(includeHidden = false, revalidate?: number) {
  const qs = includeHidden ? "?includeHidden=true" : "";
  return api.get<{ sections: ApiHomepageSection[] }>(`/homepage-sections${qs}`, {
    revalidate,
    tags: ["homepage-sections"],
  });
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

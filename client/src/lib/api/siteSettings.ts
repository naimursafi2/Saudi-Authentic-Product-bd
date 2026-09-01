import { api } from "./client";
import type { ApiSiteSettings } from "@/types/api";

/** Tagged "site-settings" so the admin portal's settings/logo update can
 * bust this instantly via `/api/revalidate` — see categories.ts. */
export async function getSiteSettings(revalidate?: number) {
  return api.get<{ settings: ApiSiteSettings }>("/site-settings", { revalidate, tags: ["site-settings"] });
}

export async function updateSiteSettings(formData: FormData) {
  return api.patchForm<{ settings: ApiSiteSettings }>("/site-settings", formData);
}

export async function updateSiteLogo(formData: FormData) {
  return api.patchForm<{ settings: ApiSiteSettings }>("/site-settings/logo", formData);
}

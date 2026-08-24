import { api } from "./client";
import type { ApiSiteSettings } from "@/types/api";

export async function getSiteSettings(revalidate?: number) {
  return api.get<{ settings: ApiSiteSettings }>("/site-settings", { revalidate });
}

export async function updateSiteSettings(formData: FormData) {
  return api.patchForm<{ settings: ApiSiteSettings }>("/site-settings", formData);
}

export async function updateSiteLogo(formData: FormData) {
  return api.patchForm<{ settings: ApiSiteSettings }>("/site-settings/logo", formData);
}

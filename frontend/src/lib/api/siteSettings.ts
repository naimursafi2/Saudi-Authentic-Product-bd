import { api } from "./client";
import type { ApiSiteSettings } from "@/types/api";

export async function getSiteSettings() {
  return api.get<{ settings: ApiSiteSettings }>("/site-settings");
}

export async function updateSiteSettings(formData: FormData) {
  return api.patchForm<{ settings: ApiSiteSettings }>("/site-settings", formData);
}

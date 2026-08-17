import { api } from "./client";
import type { ApiStaticPage, StaticPageType } from "@/types/api";

export async function listStaticPages() {
  return api.get<{ pages: ApiStaticPage[] }>("/static-pages");
}

export async function getStaticPage(type: StaticPageType) {
  return api.get<{ page: ApiStaticPage }>(`/static-pages/${type}`);
}

export async function updateStaticPage(type: StaticPageType, formData: FormData) {
  return api.patchForm<{ page: ApiStaticPage }>(`/static-pages/${type}`, formData);
}

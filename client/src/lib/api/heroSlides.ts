import { api } from "./client";
import type { ApiHeroSlide } from "@/types/api";

export async function listHeroSlides(includeInactive = false) {
  const qs = includeInactive ? "?includeInactive=true" : "";
  return api.get<{ slides: ApiHeroSlide[] }>(`/hero-slides${qs}`);
}

export async function createHeroSlide(formData: FormData) {
  return api.postForm<{ slide: ApiHeroSlide }>("/hero-slides", formData);
}

export async function updateHeroSlide(id: string, formData: FormData) {
  return api.patchForm<{ slide: ApiHeroSlide }>(`/hero-slides/${id}`, formData);
}

export async function deleteHeroSlide(id: string) {
  return api.delete<null>(`/hero-slides/${id}`);
}

import { api } from "./client";
import type { ApiNavLink } from "@/types/api";

/** Tagged "nav-links" so the admin portal's nav link create/update/delete
 * can bust this instantly via `/api/revalidate` — see categories.ts. */
export async function listNavLinks(includeHidden = false, revalidate?: number) {
  const qs = includeHidden ? "?includeHidden=true" : "";
  return api.get<{ navLinks: ApiNavLink[] }>(`/nav-links${qs}`, { revalidate, tags: ["nav-links"] });
}

export interface NavLinkInput {
  label: string;
  href: string;
  sortOrder: number;
  isVisible: boolean;
  openInNewTab: boolean;
}

export async function createNavLink(input: NavLinkInput) {
  return api.post<{ navLink: ApiNavLink }>("/nav-links", input);
}

export async function updateNavLink(id: string, input: Partial<NavLinkInput>) {
  return api.patch<{ navLink: ApiNavLink }>(`/nav-links/${id}`, input);
}

export async function deleteNavLink(id: string) {
  return api.delete<null>(`/nav-links/${id}`);
}

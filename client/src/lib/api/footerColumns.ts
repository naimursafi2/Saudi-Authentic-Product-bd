import { api } from "./client";
import type { ApiFooterColumn, ApiFooterLink } from "@/types/api";

export async function listFooterColumns(includeHidden = false, revalidate?: number) {
  const qs = includeHidden ? "?includeHidden=true" : "";
  return api.get<{ footerColumns: ApiFooterColumn[] }>(`/footer-columns${qs}`, { revalidate });
}

export interface FooterColumnInput {
  heading: string;
  sortOrder: number;
  isVisible: boolean;
  links: ApiFooterLink[];
}

export async function createFooterColumn(input: FooterColumnInput) {
  return api.post<{ footerColumn: ApiFooterColumn }>("/footer-columns", input);
}

export async function updateFooterColumn(id: string, input: Partial<FooterColumnInput>) {
  return api.patch<{ footerColumn: ApiFooterColumn }>(`/footer-columns/${id}`, input);
}

export async function deleteFooterColumn(id: string) {
  return api.delete<null>(`/footer-columns/${id}`);
}

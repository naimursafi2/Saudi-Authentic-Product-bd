import { api } from "./client";
import type { ApiApprovalSettings } from "@/types/api";

export async function getApprovalSettings() {
  return api.get<{ settings: ApiApprovalSettings }>("/approval-settings");
}

export async function updateApprovalSettings(payload: Partial<Omit<ApiApprovalSettings, "_id" | "createdAt" | "updatedAt">>) {
  return api.patch<{ settings: ApiApprovalSettings }>("/approval-settings", payload);
}

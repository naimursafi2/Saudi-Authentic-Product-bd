import { api } from "./client";
import type { ApiAuditLog } from "@/types/api";

export interface ListAuditLogsParams {
  resource?: string;
  /** Narrows to one specific record's own history, e.g. one Expense's edit trail. */
  resourceId?: string;
  page?: number;
  limit?: number;
}

export async function listAuditLogs(params: ListAuditLogsParams = {}) {
  const search = new URLSearchParams();
  if (params.resource) search.set("resource", params.resource);
  if (params.resourceId) search.set("resourceId", params.resourceId);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return api.get<{ logs: ApiAuditLog[] }>(`/audit-logs${qs ? `?${qs}` : ""}`);
}

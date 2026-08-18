import { api } from "./client";
import type { ApiPendingAction, PendingActionStatus, PendingActionType } from "@/types/api";

export interface ListPendingActionsParams {
  status?: PendingActionStatus;
  actionType?: PendingActionType;
  page?: number;
  limit?: number;
}

export async function listPendingActions(params: ListPendingActionsParams = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.actionType) search.set("actionType", params.actionType);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return api.get<{ actions: ApiPendingAction[] }>(`/pending-actions${qs ? `?${qs}` : ""}`);
}

export async function grantPendingAction(id: string, note?: string) {
  return api.patch<{ action: ApiPendingAction }>(`/pending-actions/${id}/grant`, { note });
}

export async function denyPendingAction(id: string, note?: string) {
  return api.patch<{ action: ApiPendingAction }>(`/pending-actions/${id}/deny`, { note });
}

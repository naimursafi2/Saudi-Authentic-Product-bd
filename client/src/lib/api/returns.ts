import { api } from "./client";
import type { ApiReturnRequest, RefundReasonCategory, ReturnRequestStatus, ReturnRequestType } from "@/types/api";

export interface CreateReturnRequestPayload {
  orderId: string;
  type: ReturnRequestType;
  reasonCategory: RefundReasonCategory;
  note?: string;
  desiredExchangeDetails?: string;
}

export async function createReturnRequest(payload: CreateReturnRequestPayload) {
  return api.post<{ request: ApiReturnRequest }>("/returns", payload);
}

export async function listReturnRequests(params: { status?: ReturnRequestStatus; page?: number; limit?: number } = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return api.get<{ requests: ApiReturnRequest[] }>(`/returns${qs ? `?${qs}` : ""}`);
}

export async function reviewReturnRequest(id: string, decision: "approve" | "reject", note?: string) {
  return api.patch<{ request: ApiReturnRequest }>(`/returns/${id}/review`, { decision, note });
}

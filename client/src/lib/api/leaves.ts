import { api } from "./client";
import type { ApiLeaveRequest, LeaveStatus, LeaveType } from "@/types/hr";

export async function createLeaveRequest(payload: {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}) {
  return api.post<{ leave: ApiLeaveRequest }>("/leaves", payload);
}

export async function listMyLeaves(page = 1, limit = 20) {
  return api.get<{ leaves: ApiLeaveRequest[] }>(`/leaves/mine?page=${page}&limit=${limit}`);
}

export async function cancelLeaveRequest(id: string) {
  return api.post<{ leave: ApiLeaveRequest }>(`/leaves/${id}/cancel`);
}

export async function listLeaves(params: { employee?: string; status?: LeaveStatus; page?: number; limit?: number } = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return api.get<{ leaves: ApiLeaveRequest[] }>(`/leaves${qs ? `?${qs}` : ""}`);
}

export async function reviewLeaveRequest(id: string, status: "approved" | "rejected", reviewNote?: string) {
  return api.patch<{ leave: ApiLeaveRequest }>(`/leaves/${id}/review`, { status, reviewNote });
}

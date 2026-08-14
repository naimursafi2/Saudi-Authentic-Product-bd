import { api } from "./client";
import type { ApiAttendance, AttendanceStatus } from "@/types/hr";

export async function checkIn() {
  return api.post<{ record: ApiAttendance }>("/attendance/check-in");
}

export async function checkOut(note?: string) {
  return api.post<{ record: ApiAttendance }>("/attendance/check-out", { note });
}

export async function listMyAttendance(page = 1, limit = 30) {
  return api.get<{ records: ApiAttendance[] }>(`/attendance/mine?page=${page}&limit=${limit}`);
}

export async function getTodaySummary() {
  return api.get<{
    summary: { date: string; totalCheckedIn: number } & Record<AttendanceStatus, number>;
  }>("/attendance/summary/today");
}

export async function listAttendance(params: {
  employee?: string;
  status?: AttendanceStatus;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
} = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return api.get<{ records: ApiAttendance[] }>(`/attendance${qs ? `?${qs}` : ""}`);
}

export async function updateAttendance(
  id: string,
  payload: { status?: AttendanceStatus; checkIn?: string; checkOut?: string; note?: string }
) {
  return api.patch<{ record: ApiAttendance }>(`/attendance/${id}`, payload);
}

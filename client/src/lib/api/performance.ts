import { api } from "./client";
import type { ApiPerformanceReview } from "@/types/hr";

export async function createPerformanceReview(payload: {
  employee: string;
  period: string;
  rating: number;
  notes?: string;
}) {
  return api.post<{ review: ApiPerformanceReview }>("/performance-reviews", payload);
}

export async function listMyPerformanceReviews(page = 1, limit = 20) {
  return api.get<{ reviews: ApiPerformanceReview[] }>(`/performance-reviews/mine?page=${page}&limit=${limit}`);
}

export async function listPerformanceReviews(params: { employee?: string; page?: number; limit?: number } = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return api.get<{ reviews: ApiPerformanceReview[] }>(`/performance-reviews${qs ? `?${qs}` : ""}`);
}

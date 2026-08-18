import { api } from "./client";
import type { ApiReview } from "@/types/api";

export async function listProductReviews(productId: string, page = 1, limit = 20) {
  return api.get<{ reviews: ApiReview[] }>(`/reviews/product/${productId}?page=${page}&limit=${limit}`);
}

export async function listRecentReviews(limit = 6) {
  return api.get<{ reviews: ApiReview[] }>(`/reviews/recent?limit=${limit}`);
}

export async function listAllReviews(page = 1, limit = 20) {
  return api.get<{ reviews: ApiReview[] }>(`/reviews?page=${page}&limit=${limit}`);
}

export async function createReview(productId: string, rating: number, comment: string) {
  return api.post<{ review: ApiReview }>(`/reviews/product/${productId}`, { rating, comment });
}

export async function deleteReview(id: string) {
  return api.delete<null>(`/reviews/${id}`);
}

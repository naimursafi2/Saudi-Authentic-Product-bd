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

/** `images` is optional — a review can be submitted with or without photos. */
export async function createReview(productId: string, rating: number, comment: string, images?: File[]) {
  if (!images || images.length === 0) {
    return api.post<{ review: ApiReview }>(`/reviews/product/${productId}`, { rating, comment });
  }
  const formData = new FormData();
  formData.append("rating", String(rating));
  formData.append("comment", comment);
  for (const file of images) formData.append("images", file);
  return api.postForm<{ review: ApiReview }>(`/reviews/product/${productId}`, formData);
}

export async function deleteReview(id: string) {
  return api.delete<null>(`/reviews/${id}`);
}

export async function setReviewVisibility(id: string, isApproved: boolean) {
  return api.patch<{ review: ApiReview }>(`/reviews/${id}/visibility`, { isApproved });
}

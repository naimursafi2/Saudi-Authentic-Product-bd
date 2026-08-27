import { z } from "zod";

export const createReviewSchema = z.object({
  // `z.coerce` so this still parses correctly when sent as multipart/form-data
  // (alongside optional review-photo uploads), where every field arrives as a string.
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(2).max(1000),
});

export const listReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const listRecentReviewsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(6),
});

export const updateReviewVisibilitySchema = z.object({
  isApproved: z.boolean(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewVisibilityInput = z.infer<typeof updateReviewVisibilitySchema>;

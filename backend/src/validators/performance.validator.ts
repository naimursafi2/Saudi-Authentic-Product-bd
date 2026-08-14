import { z } from "zod";

export const createPerformanceReviewSchema = z.object({
  employee: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid employee id"),
  period: z.string().trim().min(2).max(60),
  rating: z.number().int().min(1).max(5),
  notes: z.string().trim().max(2000).optional(),
});

export const listPerformanceReviewsQuerySchema = z.object({
  employee: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePerformanceReviewInput = z.infer<typeof createPerformanceReviewSchema>;
export type ListPerformanceReviewsQuery = z.infer<typeof listPerformanceReviewsQuerySchema>;

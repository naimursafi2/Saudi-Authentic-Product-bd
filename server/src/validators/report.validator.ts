import { z } from "zod";

export const salesSummaryQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const salesTimeSeriesQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  groupBy: z.enum(["day", "week", "month"]).default("day"),
});

export type SalesSummaryQuery = z.infer<typeof salesSummaryQuerySchema>;
export type SalesTimeSeriesQuery = z.infer<typeof salesTimeSeriesQuerySchema>;

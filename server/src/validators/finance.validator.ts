import { z } from "zod";

export const financeSummaryQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const revenueVsExpenseQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  groupBy: z.enum(["day", "week", "month"]).default("month"),
});

export const grossProfitQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  groupBy: z.enum(["day", "week", "month"]).default("month"),
});

export type FinanceSummaryQuery = z.infer<typeof financeSummaryQuerySchema>;
export type RevenueVsExpenseQuery = z.infer<typeof revenueVsExpenseQuerySchema>;
export type GrossProfitQuery = z.infer<typeof grossProfitQuerySchema>;

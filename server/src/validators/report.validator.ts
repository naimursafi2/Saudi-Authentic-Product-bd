import { z } from "zod";

export const salesSummaryQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type SalesSummaryQuery = z.infer<typeof salesSummaryQuerySchema>;

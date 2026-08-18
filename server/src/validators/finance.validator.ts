import { z } from "zod";

export const financeSummaryQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type FinanceSummaryQuery = z.infer<typeof financeSummaryQuerySchema>;

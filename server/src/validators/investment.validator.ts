import { z } from "zod";

export const createInvestmentSchema = z.object({
  investorName: z.string().trim().min(1).max(120),
  amountBDT: z.number().positive(),
  investedAt: z.coerce.date().optional().default(() => new Date()),
  note: z.string().trim().max(500).optional(),
});

export const listInvestmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateInvestmentInput = z.infer<typeof createInvestmentSchema>;
export type ListInvestmentsQuery = z.infer<typeof listInvestmentsQuerySchema>;

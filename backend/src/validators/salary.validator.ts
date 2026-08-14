import { z } from "zod";

export const createSalaryPaymentSchema = z.object({
  employee: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid employee id"),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000),
  amountBDT: z.number().positive(),
  note: z.string().trim().max(500).optional(),
});

export const updateSalaryStatusSchema = z.object({
  status: z.enum(["pending", "paid"]),
  note: z.string().trim().max(500).optional(),
});

export const listSalaryPaymentsQuerySchema = z.object({
  employee: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  status: z.enum(["pending", "paid"]).optional(),
  year: z.coerce.number().int().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateSalaryPaymentInput = z.infer<typeof createSalaryPaymentSchema>;
export type UpdateSalaryStatusInput = z.infer<typeof updateSalaryStatusSchema>;
export type ListSalaryPaymentsQuery = z.infer<typeof listSalaryPaymentsQuerySchema>;

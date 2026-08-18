import { z } from "zod";
import { EXPENSE_CATEGORIES, EXPENSE_STATUSES } from "../models/Expense.model";

export const createExpenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amountBDT: z.number().positive(),
  incurredAt: z.coerce.date().optional().default(() => new Date()),
  note: z.string().trim().max(500).optional(),
});

export const listExpensesQuerySchema = z.object({
  status: z.enum(EXPENSE_STATUSES).optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const reviewExpenseSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;
export type ReviewExpenseInput = z.infer<typeof reviewExpenseSchema>;

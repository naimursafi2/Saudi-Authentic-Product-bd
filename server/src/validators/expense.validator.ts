import { z } from "zod";
import { EXPENSE_CATEGORIES, EXPENSE_STATUSES } from "../models/Expense.model";

export const createExpenseSchema = z
  .object({
    category: z.enum(EXPENSE_CATEGORIES),
    // `z.coerce` so this still parses correctly when sent as multipart/form-data
    // (alongside an optional cash-memo upload), where every field arrives as a string.
    amountBDT: z.coerce.number().positive(),
    incurredAt: z.coerce.date().optional().default(() => new Date()),
    reason: z.string().trim().min(1, "Reason is required").max(500),
    otherCategoryDetail: z.string().trim().max(200).optional(),
    note: z.string().trim().max(500).optional(),
    // Offered on the client when the chosen cash-memo photo exceeds the
    // 2MB upload limit — a plain link instead of a Cloudinary upload.
    cashMemoUrl: z.string().trim().url("Enter a valid image URL").optional(),
  })
  .refine((data) => data.category !== "other" || Boolean(data.otherCategoryDetail?.trim()), {
    message: "Please specify the expense purpose for the \"Other\" category",
    path: ["otherCategoryDetail"],
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

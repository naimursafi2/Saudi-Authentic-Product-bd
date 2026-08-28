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
  /** `YYYY-MM` — narrows to one archived monthly period (`incurredAt`), see "Monthly Expense Pages / Archive". */
  month: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, "month must be in YYYY-MM format")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const reviewExpenseSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

/**
 * The editable field set for both a direct edit (`expenses.edit`) and an
 * edit *request* (`expenses.requestEdit`) — deliberately the same shape, so
 * a request's `changes` payload is exactly what a direct edit would accept,
 * verified again by the grant handler rather than trusted from the request.
 * `cashMemo` is intentionally excluded — re-attaching a receipt photo is out
 * of scope for this edit path; a wrong receipt means a fresh expense.
 */
export const editExpenseFieldsSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  amountBDT: z.coerce.number().positive().optional(),
  incurredAt: z.coerce.date().optional(),
  reason: z.string().trim().min(1, "Reason is required").max(500).optional(),
  otherCategoryDetail: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional(),
});

export const updateExpenseSchema = editExpenseFieldsSchema.refine(
  (data) => Object.keys(data).length > 0,
  { message: "Provide at least one field to update" }
);

export const requestExpenseEditSchema = z.object({
  changes: editExpenseFieldsSchema.refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one changed field",
  }),
  reason: z.string().trim().min(1, "Explain why this edit is needed").max(500),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;
export type ReviewExpenseInput = z.infer<typeof reviewExpenseSchema>;
export type EditExpenseFields = z.infer<typeof editExpenseFieldsSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type RequestExpenseEditInput = z.infer<typeof requestExpenseEditSchema>;

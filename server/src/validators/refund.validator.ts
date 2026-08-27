import { z } from "zod";
import { REFUND_REASON_CATEGORIES, REFUND_STATUSES } from "../models/Refund.model";

export const createRefundSchema = z
  .object({
    orderId: z.string().length(24),
    reasonCategory: z.enum(REFUND_REASON_CATEGORIES),
    requestedAmountBDT: z.number().positive(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.reasonCategory !== "other" || Boolean(data.note?.trim()), {
    message: "Please specify the reason",
    path: ["note"],
  });

export const listRefundsQuerySchema = z.object({
  status: z.enum(REFUND_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const reviewRefundSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional(),
});

export const reviewNoteSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export type CreateRefundInput = z.infer<typeof createRefundSchema>;
export type ListRefundsQuery = z.infer<typeof listRefundsQuerySchema>;
export type ReviewRefundInput = z.infer<typeof reviewRefundSchema>;

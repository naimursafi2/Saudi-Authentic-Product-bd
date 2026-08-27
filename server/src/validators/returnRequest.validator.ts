import { z } from "zod";
import { REFUND_REASON_CATEGORIES } from "../models/Refund.model";
import { RETURN_REQUEST_STATUSES, RETURN_REQUEST_TYPES } from "../models/ReturnRequest.model";

export const createReturnRequestSchema = z
  .object({
    orderId: z.string().length(24),
    type: z.enum(RETURN_REQUEST_TYPES),
    reasonCategory: z.enum(REFUND_REASON_CATEGORIES),
    note: z.string().trim().max(500).optional(),
    desiredExchangeDetails: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.reasonCategory !== "other" || Boolean(data.note?.trim()), {
    message: "Please specify the reason",
    path: ["note"],
  });

export const listReturnRequestsQuerySchema = z.object({
  status: z.enum(RETURN_REQUEST_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const reviewReturnRequestSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional(),
});

export type CreateReturnRequestInput = z.infer<typeof createReturnRequestSchema>;
export type ListReturnRequestsQuery = z.infer<typeof listReturnRequestsQuerySchema>;
export type ReviewReturnRequestInput = z.infer<typeof reviewReturnRequestSchema>;

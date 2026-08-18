import { z } from "zod";

export const createLeaveSchema = z
  .object({
    type: z.enum(["sick", "casual", "annual", "unpaid", "other"]),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().trim().min(2).max(1000),
  })
  .refine((val) => val.endDate >= val.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

export const reviewLeaveSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewNote: z.string().trim().max(500).optional(),
});

export const listLeavesQuerySchema = z.object({
  employee: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateLeaveInput = z.infer<typeof createLeaveSchema>;
export type ReviewLeaveInput = z.infer<typeof reviewLeaveSchema>;
export type ListLeavesQuery = z.infer<typeof listLeavesQuerySchema>;

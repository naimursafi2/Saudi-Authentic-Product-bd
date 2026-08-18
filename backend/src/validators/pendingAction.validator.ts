import { z } from "zod";
import { PENDING_ACTION_STATUSES, PENDING_ACTION_TYPES } from "../models/PendingAction.model";

export const listPendingActionsQuerySchema = z.object({
  status: z.enum(PENDING_ACTION_STATUSES).optional(),
  actionType: z.enum(PENDING_ACTION_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const reviewPendingActionSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export type ListPendingActionsQuery = z.infer<typeof listPendingActionsQuerySchema>;
export type ReviewPendingActionInput = z.infer<typeof reviewPendingActionSchema>;

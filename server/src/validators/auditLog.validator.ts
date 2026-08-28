import { z } from "zod";

export const listAuditLogsQuerySchema = z.object({
  resource: z.string().trim().optional(),
  /** Narrows to one specific record's history, e.g. one Expense's edit trail. */
  resourceId: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

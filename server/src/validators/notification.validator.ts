import { z } from "zod";
import { booleanish } from "./common.validator";

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: booleanish.optional().default(false),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

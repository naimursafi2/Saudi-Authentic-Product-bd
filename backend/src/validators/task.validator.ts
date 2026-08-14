import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional(),
  assignedTo: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid employee id"),
  dueDate: z.coerce.date().optional(),
  priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
});

export const updateTaskSchema = createTaskSchema.partial();

export const updateTaskStatusSchema = z.object({
  status: z.enum(["todo", "in_progress", "done"]),
});

export const listTasksQuerySchema = z.object({
  assignedTo: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

import { z } from "zod";

export const checkOutSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export const updateAttendanceSchema = z.object({
  status: z.enum(["present", "late", "half_day", "absent", "leave"]).optional(),
  checkIn: z.coerce.date().optional(),
  checkOut: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional(),
});

export const listAttendanceQuerySchema = z.object({
  employee: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z.enum(["present", "late", "half_day", "absent", "leave"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type CheckOutInput = z.infer<typeof checkOutSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type ListAttendanceQuery = z.infer<typeof listAttendanceQuerySchema>;

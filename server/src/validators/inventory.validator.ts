import { z } from "zod";

export const adjustStockSchema = z.object({
  productId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid product id"),
  variantId: z.string().length(24),
  delta: z.number().int().refine((v) => v !== 0, "delta must not be zero"),
  note: z.string().trim().max(500).optional(),
});

export const listInventoryLogsQuerySchema = z.object({
  product: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const stockLevelsQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type StockLevelsQuery = z.infer<typeof stockLevelsQuerySchema>;
export type ListInventoryLogsQuery = z.infer<typeof listInventoryLogsQuerySchema>;

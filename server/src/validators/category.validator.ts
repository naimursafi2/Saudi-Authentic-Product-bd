import { z } from "zod";
import { booleanish } from "./common.validator";

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers and hyphens")
    .optional(),
  description: z.string().trim().max(500).optional(),
  // `booleanish`/`z.coerce` so these still parse correctly when sent as
  // multipart/form-data string fields (alongside an image upload), not just plain JSON.
  isComingSoon: booleanish.optional().default(false),
  sortOrder: z.coerce.number().int().optional().default(0),
});

export const updateCategorySchema = createCategorySchema.partial();

export const listCategoriesQuerySchema = z.object({
  includeInactive: booleanish.optional().default(false),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;

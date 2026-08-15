import { z } from "zod";
import { booleanish } from "./common.validator";

export const createHeroSlideSchema = z.object({
  title: z.string().trim().min(1).max(160),
  subtitle: z.string().trim().max(300).optional(),
  ctaLabel: z.string().trim().max(40).optional(),
  ctaHref: z.string().trim().max(200).optional(),
  sortOrder: z.coerce.number().int().optional().default(0),
  isActive: booleanish.optional().default(true),
});

export const updateHeroSlideSchema = createHeroSlideSchema.partial();

export const listHeroSlidesQuerySchema = z.object({
  includeInactive: booleanish.optional().default(false),
});

export type CreateHeroSlideInput = z.infer<typeof createHeroSlideSchema>;
export type UpdateHeroSlideInput = z.infer<typeof updateHeroSlideSchema>;
export type ListHeroSlidesQuery = z.infer<typeof listHeroSlidesQuerySchema>;

import { z } from "zod";
import { booleanish } from "./common.validator";

export const createHeroSlideSchema = z.object({
  title: z.string().trim().min(1).max(160),
  subtitle: z.string().trim().max(300).optional(),
  ctaLabel: z.string().trim().max(40).optional(),
  ctaHref: z.string().trim().max(200).optional(),
  secondaryCtaLabel: z.string().trim().max(40).optional(),
  secondaryCtaHref: z.string().trim().max(200).optional(),
  sortOrder: z.coerce.number().int().optional().default(0),
  isActive: booleanish.optional().default(true),
});

/**
 * Spelled out rather than derived with `createHeroSlideSchema.partial()`.
 *
 * `.partial()` only makes keys optional — it does NOT strip `.default()`, so
 * a schema derived that way fills in a default for every field the request
 * omitted. The admin table PATCHes a single field at a time (the reorder
 * arrows send only `sortOrder`, the status toggle only `isActive`), so the
 * derived schema silently reset the other one: reordering a disabled slide
 * switched it back on, and toggling a slide sent it to position 0. Follow the
 * same explicit shape used by updateHomepageSectionSchema and
 * updateFooterColumnSchema — no defaults on an update schema.
 */
export const updateHeroSlideSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  subtitle: z.string().trim().max(300).optional(),
  ctaLabel: z.string().trim().max(40).optional(),
  ctaHref: z.string().trim().max(200).optional(),
  secondaryCtaLabel: z.string().trim().max(40).optional(),
  secondaryCtaHref: z.string().trim().max(200).optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: booleanish.optional(),
});

export const listHeroSlidesQuerySchema = z.object({
  includeInactive: booleanish.optional().default(false),
});

export type CreateHeroSlideInput = z.infer<typeof createHeroSlideSchema>;
export type UpdateHeroSlideInput = z.infer<typeof updateHeroSlideSchema>;
export type ListHeroSlidesQuery = z.infer<typeof listHeroSlidesQuerySchema>;

import { z } from "zod";
import { booleanish } from "./common.validator";

/** Only `promoBanner` sections are freely creatable — the five fixed types
 * are lazily seeded and only ever updated (see homepageSection.service.ts). */
export const createHomepageSectionSchema = z.object({
  title: z.string().trim().max(160).optional(),
  subtitle: z.string().trim().max(240).optional(),
  description: z.string().trim().max(1000).optional(),
  ctaLabel: z.string().trim().max(40).optional(),
  ctaHref: z.string().trim().max(200).optional(),
  isVisible: booleanish.optional().default(true),
  sortOrder: z.coerce.number().int().optional().default(0),
});

export const updateHomepageSectionSchema = z.object({
  title: z.string().trim().max(160).optional(),
  subtitle: z.string().trim().max(240).optional(),
  description: z.string().trim().max(1000).optional(),
  ctaLabel: z.string().trim().max(40).optional(),
  ctaHref: z.string().trim().max(200).optional(),
  isVisible: booleanish.optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const listHomepageSectionsQuerySchema = z.object({
  includeHidden: booleanish.optional().default(false),
});

export type CreateHomepageSectionInput = z.infer<typeof createHomepageSectionSchema>;
export type UpdateHomepageSectionInput = z.infer<typeof updateHomepageSectionSchema>;
export type ListHomepageSectionsQuery = z.infer<typeof listHomepageSectionsQuerySchema>;

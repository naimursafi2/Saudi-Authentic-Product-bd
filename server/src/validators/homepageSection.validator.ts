import { z } from "zod";
import { booleanish } from "./common.validator";
import { PRODUCT_SHOWCASE_MODES } from "../models/HomepageSection.model";
import { STATIC_PAGE_BLOCK_ICONS } from "../models/StaticPage.model";

const trustStripBlockSchema = z.object({
  icon: z.enum(STATIC_PAGE_BLOCK_ICONS),
  label: z.string().trim().min(1).max(60),
  isVisible: booleanish.optional().default(true),
});

/** Only `promoBanner`, `productShowcase` and `banner` sections are freely
 * creatable — the six fixed types are lazily seeded and only ever updated
 * (see homepageSection.service.ts). */
export const createHomepageSectionSchema = z
  .object({
    type: z.enum(["promoBanner", "productShowcase", "banner"]),
    title: z.string().trim().max(160).optional(),
    subtitle: z.string().trim().max(240).optional(),
    description: z.string().trim().max(1000).optional(),
    ctaLabel: z.string().trim().max(40).optional(),
    ctaHref: z.string().trim().max(200).optional(),
    isVisible: booleanish.optional().default(true),
    sortOrder: z.coerce.number().int().optional().default(0),
    categorySlug: z.string().trim().optional(),
    productMode: z.enum(PRODUCT_SHOWCASE_MODES).optional(),
    limit: z.coerce.number().int().min(1).max(12).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "productShowcase" && data.productMode === "category" && !data.categorySlug) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "categorySlug is required when productMode is 'category'",
        path: ["categorySlug"],
      });
    }
  });

export const updateHomepageSectionSchema = z.object({
  title: z.string().trim().max(160).optional(),
  subtitle: z.string().trim().max(240).optional(),
  description: z.string().trim().max(1000).optional(),
  ctaLabel: z.string().trim().max(40).optional(),
  ctaHref: z.string().trim().max(200).optional(),
  isVisible: booleanish.optional(),
  sortOrder: z.coerce.number().int().optional(),
  categorySlug: z.string().trim().optional(),
  productMode: z.enum(PRODUCT_SHOWCASE_MODES).optional(),
  limit: z.coerce.number().int().min(1).max(12).optional(),
  blocks: z.array(trustStripBlockSchema).optional(),
});

export const listHomepageSectionsQuerySchema = z.object({
  includeHidden: booleanish.optional().default(false),
});

export type CreateHomepageSectionInput = z.infer<typeof createHomepageSectionSchema>;
export type UpdateHomepageSectionInput = z.infer<typeof updateHomepageSectionSchema>;
export type ListHomepageSectionsQuery = z.infer<typeof listHomepageSectionsQuerySchema>;

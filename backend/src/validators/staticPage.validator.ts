import { z } from "zod";
import { STATIC_PAGE_TYPES, STATIC_PAGE_BLOCK_ICONS } from "../models/StaticPage.model";
import { booleanish } from "./common.validator";

export const staticPageTypeParamSchema = z.object({
  type: z.enum(STATIC_PAGE_TYPES),
});

const staticPageBlockSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(1000),
  icon: z.enum(STATIC_PAGE_BLOCK_ICONS).optional(),
  isVisible: booleanish.optional().default(true),
});

export const updateStaticPageSchema = z.object({
  heroTitle: z.string().trim().max(160).optional(),
  heroDescription: z.string().trim().max(2000).optional(),
  introText: z.string().trim().max(1000).optional(),
  addressLine: z.string().trim().max(200).optional(),
  blocks: z.array(staticPageBlockSchema).max(12).optional(),
  ctaTitle: z.string().trim().max(160).optional(),
  ctaDescription: z.string().trim().max(400).optional(),
  ctaButtonLabel: z.string().trim().max(40).optional(),
  ctaButtonHref: z.string().trim().max(200).optional(),
});

export type StaticPageTypeParam = z.infer<typeof staticPageTypeParamSchema>;
export type UpdateStaticPageInput = z.infer<typeof updateStaticPageSchema>;

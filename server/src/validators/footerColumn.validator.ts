import { z } from "zod";
import { booleanish } from "./common.validator";

const footerLinkSchema = z.object({
  label: z.string().trim().min(1).max(60),
  href: z.string().trim().min(1).max(200),
  sortOrder: z.coerce.number().int().optional().default(0),
});

export const createFooterColumnSchema = z.object({
  heading: z.string().trim().min(1).max(60),
  sortOrder: z.coerce.number().int().optional().default(0),
  isVisible: booleanish.optional().default(true),
  links: z.array(footerLinkSchema).max(20).optional().default([]),
});

export const updateFooterColumnSchema = z.object({
  heading: z.string().trim().min(1).max(60).optional(),
  sortOrder: z.coerce.number().int().optional(),
  isVisible: booleanish.optional(),
  links: z.array(footerLinkSchema).max(20).optional(),
});

export const listFooterColumnsQuerySchema = z.object({
  includeHidden: booleanish.optional().default(false),
});

export type CreateFooterColumnInput = z.infer<typeof createFooterColumnSchema>;
export type UpdateFooterColumnInput = z.infer<typeof updateFooterColumnSchema>;
export type ListFooterColumnsQuery = z.infer<typeof listFooterColumnsQuerySchema>;

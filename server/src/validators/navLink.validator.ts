import { z } from "zod";
import { booleanish } from "./common.validator";

export const createNavLinkSchema = z.object({
  label: z.string().trim().min(1).max(60),
  href: z.string().trim().min(1).max(200),
  sortOrder: z.coerce.number().int().optional().default(0),
  isVisible: booleanish.optional().default(true),
  openInNewTab: booleanish.optional().default(false),
});

export const updateNavLinkSchema = createNavLinkSchema.partial();

export const listNavLinksQuerySchema = z.object({
  includeHidden: booleanish.optional().default(false),
});

export type CreateNavLinkInput = z.infer<typeof createNavLinkSchema>;
export type UpdateNavLinkInput = z.infer<typeof updateNavLinkSchema>;
export type ListNavLinksQuery = z.infer<typeof listNavLinksQuerySchema>;

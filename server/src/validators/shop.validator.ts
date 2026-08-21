import { z } from "zod";
import { booleanish } from "./common.validator";

export const createShopSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(32),
  location: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional().default(true),
});

/**
 * Spelled out rather than derived with `createShopSchema.partial()` — Zod 4's
 * `.partial()` makes keys optional but does NOT strip `.default()`, so a
 * derived schema would silently re-publish a deactivated shop on any PATCH
 * that omitted `isActive`. See the `updateHeroSlideSchema` note in CLAUDE.md.
 */
export const updateShopSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  code: z.string().trim().min(1).max(32).optional(),
  location: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const listShopsQuerySchema = z.object({
  includeInactive: booleanish.optional().default(false),
});

export const assignShopsSchema = z.object({
  shopIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i, "Invalid shop id")).max(50),
});

export type CreateShopInput = z.infer<typeof createShopSchema>;
export type UpdateShopInput = z.infer<typeof updateShopSchema>;
export type ListShopsQuery = z.infer<typeof listShopsQuerySchema>;
export type AssignShopsInput = z.infer<typeof assignShopsSchema>;

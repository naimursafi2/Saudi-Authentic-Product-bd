import { z } from "zod";
import { booleanish } from "./common.validator";
import { PERMISSIONS } from "../constants/permissions";

const permissionList = z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length);

export const createRoleSchema = z.object({
  /** Uppercase snake-case, e.g. DIGITAL_MARKETER — the stable identifier. */
  key: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(
      /^[A-Za-z][A-Za-z0-9_]*$/,
      "Use letters, numbers and underscores only, starting with a letter (e.g. DIGITAL_MARKETER)"
    ),
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300).optional(),
  permissions: permissionList.default([]),
  isActive: booleanish.optional(),
});

/**
 * Spelled out rather than `createRoleSchema.partial()`: Zod's `.partial()`
 * keeps `.default()`, so a derived schema would reset `permissions` to `[]`
 * on any PATCH that didn't mention them — silently stripping a role bare.
 * Same trap documented on updateHeroSlideSchema.
 */
export const updateRoleSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(300).optional(),
  permissions: permissionList.optional(),
  isActive: booleanish.optional(),
});

export const assignRoleSchema = z.object({
  /** A custom role's id, or null to clear the assignment. */
  roleId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid role id").nullable(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;

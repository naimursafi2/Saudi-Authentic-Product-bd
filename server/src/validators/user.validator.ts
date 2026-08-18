import { z } from "zod";
import { ROLES } from "../constants/roles";

export const createStaffSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(128),
  phone: z.string().trim().min(6).max(20).optional(),
  role: z.enum(["employee", "delivery_agent", "co_admin", "order_manager", "admin"]),
  staffMeta: z
    .object({
      employeeId: z.string().trim().min(1),
      department: z.string().trim().optional(),
      designation: z.string().trim().optional(),
      baseSalaryBDT: z.number().nonnegative().optional(),
    })
    .optional(),
});

export const updateStaffMetaSchema = z.object({
  department: z.string().trim().optional(),
  designation: z.string().trim().optional(),
  baseSalaryBDT: z.number().nonnegative().optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(ROLES),
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export const addAddressSchema = z.object({
  label: z.string().trim().min(1).max(60),
  fullAddress: z.string().trim().min(3).max(300),
  district: z.string().trim().min(1).max(80),
  cityArea: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(6).max(20),
  isDefault: z.boolean().optional().default(false),
});

// Every field optional (partial edit) — `isDefault` intentionally has no
// `.default()` here, unlike `addAddressSchema`, so an update that omits it
// leaves the address's existing default flag untouched instead of resetting
// it to false.
export const updateAddressSchema = z.object({
  label: z.string().trim().min(1).max(60).optional(),
  fullAddress: z.string().trim().min(3).max(300).optional(),
  district: z.string().trim().min(1).max(80).optional(),
  cityArea: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(6).max(20).optional(),
  isDefault: z.boolean().optional(),
});

export const updateMyProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(6).max(20).optional(),
});

export const listUsersQuerySchema = z.object({
  role: z.enum(ROLES).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type AddAddressInput = z.infer<typeof addAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
export type UpdateStaffMetaInput = z.infer<typeof updateStaffMetaSchema>;
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;

import { z } from "zod";
import { booleanish } from "./common.validator";

const discountTypeEnum = z.enum(["percentage", "fixed"]);
const codeField = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]+$/, "Code may only contain letters, numbers and hyphens")
  .min(3)
  .max(30);

export const createCouponSchema = z
  .object({
    code: codeField,
    description: z.string().trim().max(300).optional(),
    discountType: discountTypeEnum,
    discountValue: z.number().positive(),
    minOrderAmountBDT: z.number().nonnegative().optional().default(0),
    startsAt: z.coerce.date(),
    expiresAt: z.coerce.date(),
    usageLimit: z.number().int().positive().optional(),
    isActive: booleanish.optional().default(true),
  })
  .refine((data) => data.expiresAt > data.startsAt, {
    message: "Expiry date must be after the start date",
    path: ["expiresAt"],
  })
  .refine((data) => data.discountType !== "percentage" || data.discountValue <= 100, {
    message: "Percentage discount cannot exceed 100",
    path: ["discountValue"],
  });

export const updateCouponSchema = z
  .object({
    code: codeField.optional(),
    description: z.string().trim().max(300).optional(),
    discountType: discountTypeEnum.optional(),
    discountValue: z.number().positive().optional(),
    minOrderAmountBDT: z.number().nonnegative().optional(),
    startsAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional(),
    usageLimit: z.number().int().positive().optional(),
    isActive: booleanish.optional(),
  })
  .refine((data) => !data.startsAt || !data.expiresAt || data.expiresAt > data.startsAt, {
    message: "Expiry date must be after the start date",
    path: ["expiresAt"],
  })
  .refine(
    (data) => data.discountType !== "percentage" || data.discountValue === undefined || data.discountValue <= 100,
    { message: "Percentage discount cannot exceed 100", path: ["discountValue"] }
  );

export const couponStatusEnum = z.enum(["scheduled", "active", "expired", "disabled"]);

export const listCouponsQuerySchema = z.object({
  status: couponStatusEnum.optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const validateCouponSchema = z.object({
  code: z.string().trim().min(1).max(30),
  subtotalBDT: z.number().positive(),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
export type ListCouponsQuery = z.infer<typeof listCouponsQuerySchema>;
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;

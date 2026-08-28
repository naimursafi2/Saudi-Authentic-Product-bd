import { z } from "zod";

const chargeField = z.number().nonnegative().max(100000);

/**
 * Spelled out in full rather than derived with `.partial()` — per CLAUDE.md,
 * Zod 4's `.partial()` keeps `.default()`s, so a PATCH touching one rate would
 * silently reset every other one back to its default. On money settings that
 * would be a live pricing incident.
 */
export const updateShippingSettingsSchema = z
  .object({
    insideDhakaChargeBDT: chargeField.optional(),
    outsideDhakaChargeBDT: chargeField.optional(),
    expressSurchargeBDT: chargeField.optional(),
    freeShippingEnabled: z.boolean().optional(),
    freeShippingMinOrderBDT: chargeField.optional(),
    freeShippingAppliesToExpress: z.boolean().optional(),
    standardDeliveryDays: z.number().int().min(1).max(90).optional(),
    expressDeliveryDays: z.number().int().min(1).max(90).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one setting to update",
  });

export type UpdateShippingSettingsInput = z.infer<typeof updateShippingSettingsSchema>;

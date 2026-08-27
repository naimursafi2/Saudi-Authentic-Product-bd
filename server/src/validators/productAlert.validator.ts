import { z } from "zod";
import { PRODUCT_ALERT_TYPES } from "../models/ProductAlert.model";

export const createProductAlertSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  type: z.enum(PRODUCT_ALERT_TYPES),
});
export type CreateProductAlertInput = z.infer<typeof createProductAlertSchema>;

import { z } from "zod";
import { PAYMENT_STATUSES } from "../models/Payment.model";

/**
 * Note what is deliberately absent from every schema here: an amount. The
 * payable figure is always recomputed from the order in the database (see
 * `payment.service.ts`), never accepted from the client — a request carrying
 * its own amount would be the exact fraud vector this module exists to close.
 */

export const initSslcommerzPaymentSchema = z.object({
  orderId: z.string().length(24),
});

export const listPaymentsQuerySchema = z.object({
  status: z.enum(PAYMENT_STATUSES).optional(),
  orderNumber: z.string().trim().min(1).max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type InitSslcommerzPaymentInput = z.infer<typeof initSslcommerzPaymentSchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;

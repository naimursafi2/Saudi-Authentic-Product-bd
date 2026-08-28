import { z } from "zod";
import { PAYMENT_STATUSES } from "../models/Payment.model";

/**
 * Note what is deliberately absent from every schema here: an amount. The
 * payable figure is always recomputed from the order in the database (see
 * `payment.service.ts`), never accepted from the client — a request carrying
 * its own amount would be the exact fraud vector this module exists to close.
 */

export const createBkashPaymentSchema = z.object({
  orderId: z.string().length(24),
});

export const executeBkashPaymentSchema = z.object({
  /** bKash's own `paymentID`, echoed back on its callback redirect. */
  paymentID: z.string().trim().min(1).max(120),
});

export const cancelBkashPaymentSchema = z.object({
  paymentID: z.string().trim().min(1).max(120),
  reason: z.string().trim().max(300).optional(),
});

export const listPaymentsQuerySchema = z.object({
  status: z.enum(PAYMENT_STATUSES).optional(),
  orderNumber: z.string().trim().min(1).max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateBkashPaymentInput = z.infer<typeof createBkashPaymentSchema>;
export type ExecuteBkashPaymentInput = z.infer<typeof executeBkashPaymentSchema>;
export type CancelBkashPaymentInput = z.infer<typeof cancelBkashPaymentSchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;

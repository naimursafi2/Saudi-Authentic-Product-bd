import { api } from "./client";
import type { ApiCreatedPayment, ApiOrder, ApiPayment, PaymentStatus } from "@/types/api";

/**
 * Note that no function here sends an amount. The payable figure is computed
 * from the order server-side on every call — see
 * `server/src/services/payment.service.ts`.
 */

/** Which gateways this deployment can actually take money through. Public, booleans only. */
export async function getPaymentConfig() {
  return api.get<{ providers: { bkash: boolean } }>("/payments/config");
}

/** Starts a bKash payment for one of the signed-in customer's own orders. */
export async function createBkashPayment(orderId: string) {
  return api.post<{ payment: ApiCreatedPayment }>("/payments/bkash/create", { orderId });
}

/** Called when the customer returns from bKash — the backend verifies with the gateway before anything is marked paid. */
export async function executeBkashPayment(paymentID: string) {
  return api.post<{ payment: ApiPayment; order: ApiOrder }>("/payments/bkash/execute", { paymentID });
}

export async function cancelBkashPayment(paymentID: string, reason?: string) {
  return api.post<{ payment: ApiPayment }>("/payments/bkash/cancel", { paymentID, reason });
}

export async function getPaymentForOrder(orderId: string) {
  return api.get<{ payment: ApiPayment | null }>(`/payments/order/${orderId}`);
}

// -- Staff (read-only) --
// There is no "verify"/"settle" call here on purpose: verification is entirely
// automatic, on the customer's callback and on the server's reconciliation
// sweep. Staff can see payments, never settle one by hand.

export async function listPayments(
  params: { status?: PaymentStatus; orderNumber?: string; page?: number; limit?: number } = {}
) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.orderNumber) search.set("orderNumber", params.orderNumber);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return api.get<{ payments: ApiPayment[] }>(`/payments${qs ? `?${qs}` : ""}`);
}

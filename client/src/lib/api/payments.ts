import { api } from "./client";
import type { ApiCreatedPayment, ApiPayment, PaymentStatus } from "@/types/api";

/**
 * Note that no function here sends an amount. The payable figure is computed
 * from the order server-side on every call — see
 * `server/src/services/payment.service.ts`.
 */

/** Which gateways this deployment can actually take money through. Public, booleans only. */
export async function getPaymentConfig() {
  return api.get<{ providers: { sslcommerz: boolean } }>("/payments/config");
}

/**
 * Staff-only. Explains why online payment may be missing from checkout,
 * naming the unset server environment variables (never their values).
 * Requires `payments.view`.
 */
export async function getGatewayStatus() {
  return api.get<{
    sslcommerz: { configured: boolean; missingKeys: string[]; mode: "sandbox" | "live" };
  }>("/payments/gateway-status");
}

/**
 * Starts an SSLCommerz payment for one of the signed-in customer's own
 * orders. The browser is then sent to `payment.gatewayUrl`; SSLCommerz posts
 * the result back to the server, which verifies it and redirects the customer
 * to `/checkout/payment/success | failed | cancelled`.
 */
export async function initSslcommerzPayment(orderId: string) {
  return api.post<{ payment: ApiCreatedPayment }>("/payments/sslcommerz/init", { orderId });
}

export async function getPaymentForOrder(orderId: string) {
  return api.get<{ payment: ApiPayment | null }>(`/payments/order/${orderId}`);
}

// -- Staff (read-only) --
// There is no "verify"/"settle" call here on purpose: verification is entirely
// automatic, on the gateway callback and on the server's reconciliation
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

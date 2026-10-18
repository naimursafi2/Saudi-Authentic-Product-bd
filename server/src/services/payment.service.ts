import crypto from "crypto";
import { Types } from "mongoose";
import {
  PaymentModel,
  PAYMENT_TRANSITIONS,
  type IPayment,
  type PaymentStatus,
} from "../models/Payment.model";
import { OrderModel, type IOrder } from "../models/Order.model";
import { ApiError } from "../utils/ApiError";
import { clientOrigins, env, serverPublicUrl } from "../config/env";
import {
  initSslcommerzPayment,
  validateSslcommerzPayment,
  querySslcommerzTransaction,
  isSslcommerzConfigured,
  isSuccessfulStatus,
  type SslcommerzTransaction,
} from "../config/sslcommerz";
import { recordAuditLog } from "./auditLog.service";
import { ORDER_TRANSITIONS } from "../constants/orderStatus";
import type { Role } from "../constants/roles";
import type { ListPaymentsQuery } from "../validators/payment.validator";

export interface PaymentActor {
  id: string;
  role: Role;
}

/**
 * How long a still-unfinished SSLCommerz session is offered back to the
 * customer instead of a fresh one being created. Re-offering the same session
 * is what stops a customer who double-clicks "Pay Now" or reloads the page
 * from ending up with two separate chargeable sessions.
 */
const PAYMENT_REUSE_WINDOW_MS = 25 * 60 * 1000;

/**
 * How long an unresolved payment is left alone before the scheduler asks
 * SSLCommerz about it. Comfortably longer than a customer needs to finish on
 * the hosted page and be redirected back, so the sweep never races the
 * customer's own callback for the same payment.
 */
const PAYMENT_RECONCILE_AFTER_MS = 15 * 60 * 1000;

/**
 * Past this age, a payment SSLCommerz still does not call complete is treated
 * as abandoned and failed, releasing it so the customer can start a fresh
 * attempt.
 */
const PAYMENT_ABANDON_AFTER_MS = 45 * 60 * 1000;

/** Caps how many payments one tick reconciles, so a backlog can't stall the scheduler. */
const PAYMENT_RECONCILE_BATCH_SIZE = 25;

function assertTransition(current: PaymentStatus, next: PaymentStatus) {
  if (!PAYMENT_TRANSITIONS[current].includes(next)) {
    throw ApiError.badRequest(`A ${current} payment cannot become ${next}`);
  }
}

/** BDT amounts are compared in paisa so a float round-trip through the gateway's string form can't drift. */
function toPaisa(amount: number): number {
  return Math.round(amount * 100);
}

function amountsMatch(gatewayAmount: string | undefined, expectedBDT: number): boolean {
  if (!gatewayAmount) return false;
  const parsed = Number(gatewayAmount);
  if (!Number.isFinite(parsed)) return false;
  return toPaisa(parsed) === toPaisa(expectedBDT);
}

/** Only the gateway fields that are safe to keep — never a credential. */
function safeMetadata(result: SslcommerzTransaction): Record<string, unknown> {
  return {
    status: result.status,
    valId: result.valId,
    amount: result.amount,
    currency: result.currency,
    bankTranId: result.bankTranId,
    cardType: result.cardType,
    riskLevel: result.riskLevel,
    riskTitle: result.riskTitle,
    tranDate: result.tranDate,
    error: result.error,
  };
}

/** A unique, unguessable `tran_id` per attempt — e.g. `SAP-20261018-0001-9f3a1c2b7d4e`. */
function generateTranId(orderNumber: string): string {
  return `${orderNumber}-${crypto.randomBytes(6).toString("hex")}`;
}

function callbackUrl(kind: "success" | "fail" | "cancel" | "ipn"): string {
  return `${serverPublicUrl}${env.API_PREFIX}/payments/sslcommerz/${kind}`;
}

function clientOrigin(): string {
  return (clientOrigins[0] ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** The storefront result pages SSLCommerz's browser callbacks are redirected to. */
export type PaymentResultPage = "success" | "failed" | "cancelled";

export function paymentResultUrl(
  page: PaymentResultPage,
  params: { orderId?: string; orderNumber?: string; reason?: string } = {}
): string {
  const qs = new URLSearchParams();
  if (params.orderId) qs.set("orderId", params.orderId);
  if (params.orderNumber) qs.set("order", params.orderNumber);
  if (params.reason) qs.set("reason", params.reason);
  const query = qs.toString();
  return `${clientOrigin()}/checkout/payment/${page}${query ? `?${query}` : ""}`;
}

/**
 * Marks the order paid and moves it out of `pending`, exactly once.
 *
 * The `isPaid: false` guard makes this idempotent at the database level: a
 * replayed callback that somehow got past the payment-record guard still
 * matches nothing here and changes nothing. **Stock is deliberately not
 * touched** — `order.service.ts#createOrder` already consumed it when the
 * order was placed, so payment confirmation has no inventory side effect.
 */
async function confirmOrderAfterPayment(orderId: Types.ObjectId, actor: PaymentActor): Promise<void> {
  const claimed = await OrderModel.findOneAndUpdate(
    { _id: orderId, isPaid: false },
    { $set: { isPaid: true } },
    { returnDocument: "after" }
  );
  if (!claimed) return;

  if (ORDER_TRANSITIONS[claimed.status].includes("confirmed")) {
    claimed.statusHistory.push({
      status: "confirmed",
      previousStatus: claimed.status,
      at: new Date(),
      note: "Payment verified with SSLCommerz",
      changedBy: new Types.ObjectId(actor.id),
      changedByRole: actor.role,
    });
    claimed.status = "confirmed";
    await claimed.save();
  }
}

/** Reverses `confirmOrderAfterPayment`'s money flag when a payment is refunded. */
export async function markPaymentRefundedForOrder(orderId: string, actor: PaymentActor): Promise<void> {
  const payment = await PaymentModel.findOne({ order: orderId, status: "paid" });
  if (!payment) return;

  payment.status = "refunded";
  await payment.save();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "payment.refunded",
    resource: "Payment",
    resourceId: payment._id.toString(),
    newValue: { transactionId: payment.transactionId, amountBDT: payment.amountBDT },
    note: `SSLCommerz payment marked refunded for order ${payment.merchantInvoiceNumber}.`,
  });
}

async function loadOwnOrder(orderId: string, actor: PaymentActor): Promise<IOrder> {
  const order = await OrderModel.findById(orderId);
  if (!order) throw ApiError.notFound("Order not found");
  if (order.customer.toString() !== actor.id) {
    throw ApiError.forbidden("You can only pay for your own order");
  }
  return order;
}

/**
 * Step 1: open an SSLCommerz hosted-checkout session for one of the caller's
 * own orders.
 *
 * The payable amount comes from `order.totalBDT` — recomputed server-side at
 * checkout — and the request body carries nothing but an order id, so there
 * is no amount for a client to tamper with in the first place.
 */
export async function initSslcommerzPaymentForOrder(orderId: string, actor: PaymentActor) {
  const order = await loadOwnOrder(orderId, actor);

  if (order.paymentMethod !== "sslcommerz") {
    throw ApiError.badRequest("This order was not placed with online payment as its payment method");
  }
  if (order.isPaid) {
    throw ApiError.conflict("This order has already been paid for");
  }
  if (!ORDER_TRANSITIONS[order.status].includes("confirmed")) {
    throw ApiError.badRequest(`An order that is already ${order.status} can no longer be paid for`);
  }

  const amountBDT = order.totalBDT;
  if (amountBDT <= 0) {
    throw ApiError.badRequest("This order has nothing left to pay");
  }

  // An unfinished attempt on the same order for the same amount is handed
  // back rather than replaced, so a double-click or a page reload reuses one
  // gateway session instead of opening a second one.
  const existing = await PaymentModel.findOne({
    order: order._id,
    status: { $in: ["initiated", "pending"] },
  }).sort({ createdAt: -1 });

  if (existing) {
    const isReusable =
      existing.status === "initiated" &&
      toPaisa(existing.amountBDT) === toPaisa(amountBDT) &&
      Date.now() - existing.createdAt.getTime() < PAYMENT_REUSE_WINDOW_MS &&
      typeof existing.gatewayMetadata?.gatewayUrl === "string";
    if (isReusable) return existing;

    if (existing.status === "initiated") {
      existing.status = "cancelled";
      existing.failureReason = "Superseded by a newer payment attempt";
      await existing.save();
    } else {
      // A `pending` attempt is mid-verification — never cancel it under the
      // gateway's feet; ask the customer to wait for it to resolve instead.
      throw ApiError.conflict(
        "A payment for this order is still being confirmed. Please check back in a few minutes."
      );
    }
  }

  const tranId = generateTranId(order.orderNumber);
  const customerName = `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`.trim();
  const productName =
    order.items.map((item) => item.productName).filter(Boolean).join(", ") || `Order ${order.orderNumber}`;

  const payment = await PaymentModel.create({
    order: order._id,
    customer: order.customer,
    provider: "sslcommerz",
    amountBDT,
    currency: "BDT",
    status: "initiated",
    gatewayPaymentId: tranId,
    merchantInvoiceNumber: order.orderNumber,
    initiatedBy: actor.id,
  });

  let gateway;
  try {
    gateway = await initSslcommerzPayment({
      tranId,
      amountBDT,
      successUrl: callbackUrl("success"),
      failUrl: callbackUrl("fail"),
      cancelUrl: callbackUrl("cancel"),
      ipnUrl: callbackUrl("ipn"),
      customer: {
        name: customerName || "Customer",
        email: order.shippingAddress.email,
        phone: order.shippingAddress.phone,
        address: order.shippingAddress.fullAddress,
        city: order.shippingAddress.district,
      },
      productName,
      numOfItems: order.items.reduce((sum, item) => sum + item.quantity, 0),
      valueA: payment._id.toString(),
    });
  } catch (err) {
    payment.status = "failed";
    payment.failureReason = "SSLCommerz refused to open a checkout session";
    await payment.save();
    throw err;
  }

  payment.gatewayMetadata = { gatewayUrl: gateway.gatewayUrl };
  await payment.save();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "payment.initiated",
    resource: "Payment",
    resourceId: payment._id.toString(),
    newValue: { orderNumber: order.orderNumber, amountBDT, provider: "sslcommerz" },
    note: `SSLCommerz payment initiated for order ${order.orderNumber} (৳${amountBDT}).`,
  });

  return payment;
}

/**
 * Records a rejected verification on the payment and in the audit trail.
 * Never throws — callbacks redirect, the sweep carries on to the next payment.
 */
async function applyRejection(
  payment: IPayment,
  order: IOrder | null,
  actor: PaymentActor,
  reason: string,
  result: SslcommerzTransaction | null,
  nextStatus: Extract<PaymentStatus, "failed" | "cancelled">
): Promise<void> {
  if (PAYMENT_TRANSITIONS[payment.status].includes(nextStatus)) {
    payment.status = nextStatus;
    payment.failureReason = reason;
    payment.gatewayMetadata = {
      ...(payment.gatewayMetadata ?? {}),
      ...(result ? safeMetadata(result) : {}),
    };
    await payment.save();
  }

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: nextStatus === "cancelled" ? "payment.cancelled" : "payment.verification.rejected",
    resource: "Payment",
    resourceId: payment._id.toString(),
    newValue: {
      orderNumber: order?.orderNumber ?? payment.merchantInvoiceNumber,
      expectedAmountBDT: payment.amountBDT,
      gatewayAmount: result?.amount,
      gatewayStatus: result?.status,
    },
    note: reason,
  });
}

/**
 * Checks a gateway result against the order it claims to belong to. Every
 * value compared here comes from the database or from SSLCommerz's own
 * validation API — nothing the customer's browser posted is trusted.
 */
function verificationFailureReason(
  result: SslcommerzTransaction,
  payment: IPayment,
  order: IOrder
): string | null {
  if (!isSuccessfulStatus(result.status)) {
    return `Gateway reported the payment as "${result.status ?? "unknown"}", not VALID.`;
  }
  if (result.tranId !== payment.gatewayPaymentId) {
    return `Gateway transaction ${result.tranId ?? "(none)"} does not match payment ${payment.gatewayPaymentId}.`;
  }
  if (result.currency && result.currency !== "BDT") {
    return `Gateway settled in ${result.currency}, not BDT.`;
  }
  if (!amountsMatch(result.amount, payment.amountBDT)) {
    return `Gateway settled ${result.amount ?? "an unknown amount"} against an expected ৳${payment.amountBDT}.`;
  }
  // The payment was priced from the order at creation time; re-checking here
  // catches an order whose total legitimately changed in between.
  if (toPaisa(payment.amountBDT) !== toPaisa(order.totalBDT)) {
    return `Payment amount ৳${payment.amountBDT} no longer matches the order total ৳${order.totalBDT}.`;
  }
  return null;
}

/**
 * Settles a verified payment. The `status` guard is the single point that
 * makes the whole flow idempotent: whichever concurrent or replayed request
 * (browser callback, IPN, sweep) wins the update performs the order
 * confirmation, and every other one sees a no-match.
 */
async function settleVerifiedPayment(
  payment: IPayment,
  result: SslcommerzTransaction,
  actor: PaymentActor,
  source: string
): Promise<IPayment> {
  const settled = await PaymentModel.findOneAndUpdate(
    { _id: payment._id, status: { $in: ["initiated", "pending"] } },
    {
      $set: {
        status: "paid",
        transactionId: result.bankTranId ?? result.valId,
        paidAt: new Date(),
        gatewayMetadata: { ...(payment.gatewayMetadata ?? {}), ...safeMetadata(result) },
      },
      $unset: { failureReason: "" },
    },
    { returnDocument: "after" }
  );

  if (!settled) {
    const current = await PaymentModel.findById(payment._id);
    if (!current) throw ApiError.notFound("Payment not found");
    return current;
  }

  await confirmOrderAfterPayment(settled.order, actor);

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "payment.verified",
    resource: "Payment",
    resourceId: settled._id.toString(),
    newValue: {
      orderNumber: settled.merchantInvoiceNumber,
      amountBDT: settled.amountBDT,
      transactionId: settled.transactionId,
      riskLevel: result.riskLevel,
    },
    note: `SSLCommerz payment verified for order ${settled.merchantInvoiceNumber} (৳${settled.amountBDT}) via ${source}.${
      result.riskLevel === "1" ? ` Flagged high-risk by SSLCommerz (${result.riskTitle ?? "no reason given"}) — review before shipping.` : ""
    }`,
  });

  return settled;
}

/** The customer who started the payment — the audit actor for every gateway-driven event. */
function payerActor(payment: IPayment): PaymentActor {
  return { id: payment.initiatedBy.toString(), role: "customer" };
}

export interface CallbackOutcome {
  page: PaymentResultPage;
  orderId?: string;
  orderNumber?: string;
  reason?: string;
}

/**
 * Applies one validated success to a payment: validation API by `val_id`,
 * then the same checks and idempotent settle as every other path.
 */
async function resolveWithValId(payment: IPayment, valId: string, source: string): Promise<CallbackOutcome> {
  const order = await OrderModel.findById(payment.order);
  const base = { orderId: payment.order.toString(), orderNumber: payment.merchantInvoiceNumber };
  if (!order) return { page: "failed", ...base, reason: "verification_failed" };

  if (payment.status === "paid" || payment.status === "refunded") {
    return { page: "success", ...base };
  }
  if (payment.status === "failed" || payment.status === "cancelled") {
    return { page: "failed", ...base, reason: "closed" };
  }

  if (payment.status === "initiated") {
    assertTransition(payment.status, "pending");
    payment.status = "pending";
    await payment.save();
  }

  // A network error here leaves the payment `pending`; the reconciliation
  // sweep picks it up and settles it once SSLCommerz is reachable again.
  let result: SslcommerzTransaction;
  try {
    result = await validateSslcommerzPayment(valId);
  } catch (err) {
    console.error(`[payments] SSLCommerz validation unreachable for ${payment.gatewayPaymentId}:`, (err as Error).message);
    return { page: "failed", ...base, reason: "verification_pending" };
  }

  const failure = verificationFailureReason(result, payment, order);
  if (failure) {
    await applyRejection(payment, order, payerActor(payment), failure, result, "failed");
    return { page: "failed", ...base, reason: "verification_failed" };
  }

  await settleVerifiedPayment(payment, result, payerActor(payment), source);
  return { page: "success", ...base };
}

async function findPaymentByTranId(tranId: string | undefined): Promise<IPayment | null> {
  if (!tranId || typeof tranId !== "string" || tranId.length > 120) return null;
  return PaymentModel.findOne({ gatewayPaymentId: tranId, provider: "sslcommerz" });
}

/**
 * SSLCommerz posted the customer's browser to our success URL. The posted
 * fields are only used to *find* the payment and the `val_id` to validate —
 * whether anything is paid is decided solely by SSLCommerz's validation API.
 */
export async function handleSslcommerzSuccess(body: Record<string, unknown>): Promise<CallbackOutcome> {
  const payment = await findPaymentByTranId(body.tran_id as string | undefined);
  if (!payment) return { page: "failed", reason: "unknown_payment" };

  const valId = typeof body.val_id === "string" ? body.val_id.trim() : "";
  if (!valId) {
    return {
      page: "failed",
      orderId: payment.order.toString(),
      orderNumber: payment.merchantInvoiceNumber,
      reason: "verification_failed",
    };
  }
  return resolveWithValId(payment, valId, "the customer's return from SSLCommerz");
}

/**
 * SSLCommerz posted the customer's browser to our fail or cancel URL.
 *
 * The callback alone is never trusted to close a payment (anyone can POST a
 * form): the gateway is asked for the transaction's real state first. If it
 * turns out SSLCommerz actually has a successful attempt, that wins and the
 * payment settles; if the lookup itself fails, the payment is left for the
 * reconciliation sweep.
 */
export async function handleSslcommerzFailOrCancel(
  body: Record<string, unknown>,
  kind: "failed" | "cancelled"
): Promise<CallbackOutcome> {
  const payment = await findPaymentByTranId(body.tran_id as string | undefined);
  if (!payment) return { page: kind, reason: "unknown_payment" };

  const base = { orderId: payment.order.toString(), orderNumber: payment.merchantInvoiceNumber };
  if (payment.status === "paid" || payment.status === "refunded") return { page: "success", ...base };
  if (payment.status === "failed" || payment.status === "cancelled") return { page: kind, ...base };

  let attempts: SslcommerzTransaction[];
  try {
    attempts = await querySslcommerzTransaction(payment.gatewayPaymentId);
  } catch (err) {
    console.error(`[payments] SSLCommerz query unreachable for ${payment.gatewayPaymentId}:`, (err as Error).message);
    return { page: kind, ...base };
  }

  const succeeded = attempts.find((a) => isSuccessfulStatus(a.status) && a.valId);
  if (succeeded?.valId) {
    return resolveWithValId(payment, succeeded.valId, "a fail/cancel callback that SSLCommerz reports as paid");
  }

  const order = await OrderModel.findById(payment.order);
  await applyRejection(
    payment,
    order,
    payerActor(payment),
    kind === "cancelled"
      ? "Customer cancelled the payment on SSLCommerz."
      : `SSLCommerz reported the payment as failed${attempts[0]?.error ? ` (${attempts[0].error})` : ""}.`,
    attempts[0] ?? null,
    kind
  );
  return { page: kind, ...base };
}

/**
 * Server-to-server IPN. Same rule as the browser callback: only SSLCommerz's
 * validation API decides; the posted status is a hint about which path to run.
 */
export async function handleSslcommerzIpn(body: Record<string, unknown>): Promise<{ handled: boolean }> {
  const payment = await findPaymentByTranId(body.tran_id as string | undefined);
  if (!payment) return { handled: false };

  const status = typeof body.status === "string" ? body.status.toUpperCase() : "";
  const valId = typeof body.val_id === "string" ? body.val_id.trim() : "";

  if (isSuccessfulStatus(status) && valId) {
    await resolveWithValId(payment, valId, "SSLCommerz IPN");
    return { handled: true };
  }
  if (status === "FAILED" || status === "CANCELLED" || status === "UNATTEMPTED" || status === "EXPIRED") {
    await handleSslcommerzFailOrCancel(body, status === "CANCELLED" ? "cancelled" : "failed");
    return { handled: true };
  }
  return { handled: false };
}

/**
 * Reconciles one payment left unresolved because neither the customer's
 * browser nor the IPN made it back — a closed tab, a dead connection, a
 * localhost IPN URL. Asks SSLCommerz for the authoritative state and applies
 * exactly the same verification and settling path as the customer flow.
 */
async function reconcileOnePayment(payment: IPayment): Promise<void> {
  const actor = payerActor(payment);
  const order = await OrderModel.findById(payment.order);
  if (!order) return;

  const attempts = await querySslcommerzTransaction(payment.gatewayPaymentId);
  const ageMs = Date.now() - payment.createdAt.getTime();

  const succeeded = attempts.find((a) => isSuccessfulStatus(a.status) && a.valId);
  if (succeeded?.valId) {
    await resolveWithValId(payment, succeeded.valId, "automatic reconciliation");
    return;
  }

  const cancelled = attempts.find((a) => a.status === "CANCELLED");
  if (cancelled) {
    await applyRejection(
      payment,
      order,
      actor,
      "Customer cancelled the payment on SSLCommerz; detected by automatic reconciliation.",
      cancelled,
      "cancelled"
    );
    return;
  }

  // Still unfinished at the gateway. Left alone until it is past any chance
  // of completing, so a slow customer is never failed out from under themselves.
  if (ageMs >= PAYMENT_ABANDON_AFTER_MS) {
    await applyRejection(
      payment,
      order,
      actor,
      `Payment abandoned — SSLCommerz reported ${attempts.length ? `"${attempts[0]!.status ?? "unknown"}"` : "no completed attempt"} well past the checkout window.`,
      attempts[0] ?? null,
      "failed"
    );
  }
}

/**
 * The scheduler's payment tick. Never throws: one unreachable gateway call
 * must not stop the sweep, nor take the scheduler down with it. Returns how
 * many payments were processed, for logging and tests.
 */
export async function reconcileStalePayments(): Promise<number> {
  if (!isSslcommerzConfigured) return 0;

  const stale = await PaymentModel.find({
    provider: "sslcommerz",
    status: { $in: ["initiated", "pending"] },
    createdAt: { $lte: new Date(Date.now() - PAYMENT_RECONCILE_AFTER_MS) },
  }).limit(PAYMENT_RECONCILE_BATCH_SIZE);

  let resolved = 0;
  for (const payment of stale) {
    try {
      await reconcileOnePayment(payment);
      resolved += 1;
    } catch (err) {
      console.error(
        `[payments] reconciliation failed for ${payment._id.toString()}:`,
        (err as Error).message
      );
    }
  }
  return resolved;
}

export async function listPayments(filter: ListPaymentsQuery) {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.orderNumber) query.merchantInvoiceNumber = filter.orderNumber.trim().toUpperCase();

  const skip = (filter.page - 1) * filter.limit;
  const [payments, total] = await Promise.all([
    PaymentModel.find(query)
      .populate("order", "orderNumber totalBDT status")
      .populate("customer", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filter.limit),
    PaymentModel.countDocuments(query),
  ]);

  return {
    payments,
    pagination: {
      page: filter.page,
      limit: filter.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filter.limit)),
    },
  };
}

/**
 * The payment attached to one order, for the customer's own order page and
 * for staff. A settled payment always wins over a superseded attempt.
 */
export async function getPaymentForOrder(orderId: string) {
  const settled = await PaymentModel.findOne({
    order: orderId,
    status: { $in: ["paid", "refunded"] },
  }).sort({ createdAt: -1 });
  if (settled) return settled;
  return PaymentModel.findOne({ order: orderId }).sort({ createdAt: -1 });
}

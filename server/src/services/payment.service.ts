import { Types } from "mongoose";
import {
  PaymentModel,
  PAYMENT_TRANSITIONS,
  type IPayment,
  type PaymentStatus,
} from "../models/Payment.model";
import { OrderModel, type IOrder } from "../models/Order.model";
import { ApiError } from "../utils/ApiError";
import { clientOrigins } from "../config/env";
import {
  createBkashPayment,
  executeBkashPayment,
  queryBkashPayment,
  isBkashConfigured,
  type BkashPaymentStatusResult,
} from "../config/bkash";
import { recordAuditLog } from "./auditLog.service";
import { ORDER_TRANSITIONS } from "../constants/orderStatus";
import type { Role } from "../constants/roles";
import type { ListPaymentsQuery } from "../validators/payment.validator";

export interface PaymentActor {
  id: string;
  role: Role;
}

/**
 * How long a still-unfinished bKash payment is offered back to the customer
 * instead of a fresh one being created. bKash's hosted checkout session is
 * good for roughly half an hour; re-offering the same session is what stops a
 * customer who double-clicks "Pay Now" or reloads the page from being charged
 * on two separate gateway payments.
 */
const PAYMENT_REUSE_WINDOW_MS = 25 * 60 * 1000;

/**
 * How long an unresolved payment is left alone before the scheduler asks bKash
 * about it. Comfortably longer than a customer needs to finish on the hosted
 * page and be redirected back, so the sweep never races the customer's own
 * callback for the same payment.
 */
const PAYMENT_RECONCILE_AFTER_MS = 15 * 60 * 1000;

/**
 * Past this age, a payment bKash still does not call complete is treated as
 * abandoned and failed, releasing it so the customer can start a fresh
 * attempt. Beyond the ~30-minute bKash checkout session, so a slow customer is
 * never failed while they could still legitimately complete.
 */
const PAYMENT_ABANDON_AFTER_MS = 45 * 60 * 1000;

/** Caps how many payments one tick reconciles, so a backlog can't stall the scheduler. */
const PAYMENT_RECONCILE_BATCH_SIZE = 25;

/**
 * The message every rejected verification returns to the customer. Deliberately
 * uniform and vague: the specific reason (amount mismatch, wrong invoice
 * reference, unknown transaction) is recorded on the payment and in the audit
 * log for staff, but telling a would-be attacker *which* of their forged fields
 * was caught just tells them what to forge next.
 */
const VERIFICATION_FAILED_MESSAGE =
  "We could not verify this payment with bKash. No money has been taken for this order — please try again or contact support.";

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

/** Only the gateway fields that are safe to keep — never a token or credential. */
function safeMetadata(result: BkashPaymentStatusResult): Record<string, unknown> {
  return {
    transactionStatus: result.transactionStatus,
    statusCode: result.statusCode,
    statusMessage: result.statusMessage,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
    amount: result.amount,
    currency: result.currency,
    merchantInvoiceNumber: result.merchantInvoiceNumber,
  };
}

function bkashCallbackUrl(): string {
  const origin = clientOrigins[0] ?? "http://localhost:3000";
  return `${origin.replace(/\/+$/, "")}/checkout/bkash/callback`;
}

/**
 * Marks the order paid and moves it out of `pending`, exactly once.
 *
 * The `isPaid: false` guard makes this idempotent at the database level: a
 * replayed callback that somehow got past the payment-record guard still
 * matches nothing here and changes nothing. **Stock is deliberately not
 * touched** — `order.service.ts#createOrder` already consumed it, once, when
 * the order was placed, so payment confirmation has no inventory side effect
 * at all and repeated callbacks cannot double-deduct.
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
      note: "Payment verified with bKash",
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
    note: `bKash payment marked refunded for order ${payment.merchantInvoiceNumber}.`,
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
 * Step 1 of the bKash flow: create a gateway payment for one of the caller's
 * own orders.
 *
 * The payable amount comes from `order.totalBDT` — recomputed server-side at
 * checkout from live product prices, the coupon and the shipping table — and
 * the request body carries nothing but an order id, so there is no amount for
 * a client to tamper with in the first place.
 */
export async function createBkashPaymentForOrder(orderId: string, actor: PaymentActor) {
  const order = await loadOwnOrder(orderId, actor);

  if (order.paymentMethod !== "bkash") {
    throw ApiError.badRequest("This order was not placed with bKash as its payment method");
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
  // gateway session instead of opening a second chargeable one.
  const existing = await PaymentModel.findOne({
    order: order._id,
    status: { $in: ["initiated", "pending"] },
  }).sort({ createdAt: -1 });

  if (existing) {
    const isReusable =
      toPaisa(existing.amountBDT) === toPaisa(amountBDT) &&
      Date.now() - existing.createdAt.getTime() < PAYMENT_REUSE_WINDOW_MS &&
      typeof existing.gatewayMetadata?.bkashURL === "string";
    if (isReusable) return existing;

    existing.status = "cancelled";
    existing.failureReason = "Superseded by a newer payment attempt";
    await existing.save();
  }

  const gateway = await createBkashPayment({
    amountBDT,
    merchantInvoiceNumber: order.orderNumber,
    callbackURL: bkashCallbackUrl(),
    payerReference: order.shippingAddress.phone,
  });

  const payment = await PaymentModel.create({
    order: order._id,
    customer: order.customer,
    provider: "bkash",
    amountBDT,
    currency: "BDT",
    status: "initiated",
    gatewayPaymentId: gateway.paymentID,
    merchantInvoiceNumber: order.orderNumber,
    gatewayMetadata: {
      bkashURL: gateway.bkashURL,
      transactionStatus: gateway.transactionStatus,
      amount: gateway.amount,
      currency: gateway.currency,
      merchantInvoiceNumber: gateway.merchantInvoiceNumber,
    },
    initiatedBy: actor.id,
  });

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "payment.initiated",
    resource: "Payment",
    resourceId: payment._id.toString(),
    newValue: { orderNumber: order.orderNumber, amountBDT, provider: "bkash" },
    note: `bKash payment initiated for order ${order.orderNumber} (৳${amountBDT}).`,
  });

  return payment;
}

/**
 * Records a rejected verification on the payment and in the audit trail.
 * Deliberately does not throw — the customer-facing path wraps this in
 * `rejectVerification` below, while the background reconciliation sweep needs
 * to record the same outcome and carry on to the next payment.
 */
async function applyRejection(
  payment: IPayment,
  order: IOrder | null,
  actor: PaymentActor,
  reason: string,
  result: BkashPaymentStatusResult,
  nextStatus: Extract<PaymentStatus, "failed" | "cancelled">
): Promise<void> {
  if (PAYMENT_TRANSITIONS[payment.status].includes(nextStatus)) {
    payment.status = nextStatus;
    payment.failureReason = reason;
    payment.gatewayMetadata = safeMetadata(result);
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
      gatewayAmount: result.amount,
      gatewayStatus: result.transactionStatus,
    },
    note: reason,
  });
}

/** As `applyRejection`, then throws the customer-facing error. */
async function rejectVerification(
  payment: IPayment,
  order: IOrder | null,
  actor: PaymentActor,
  reason: string,
  result: BkashPaymentStatusResult,
  nextStatus: Extract<PaymentStatus, "failed" | "cancelled">
): Promise<never> {
  await applyRejection(payment, order, actor, reason, result, nextStatus);

  throw nextStatus === "cancelled"
    ? ApiError.badRequest("This bKash payment was cancelled. Your order has not been paid for.")
    : ApiError.badRequest(VERIFICATION_FAILED_MESSAGE);
}

/**
 * Checks a gateway result against the order it claims to belong to. Every
 * value compared here comes from the database or from bKash itself — nothing
 * the customer's browser sent is trusted, including the amount.
 */
function verificationFailureReason(
  result: BkashPaymentStatusResult,
  payment: IPayment,
  order: IOrder
): string | null {
  if (result.transactionStatus !== "Completed") {
    return `Gateway reported the payment as "${result.transactionStatus ?? "unknown"}", not Completed.`;
  }
  if (!result.trxID) {
    return "Gateway reported the payment complete but returned no transaction id.";
  }
  if (result.merchantInvoiceNumber && result.merchantInvoiceNumber !== order.orderNumber) {
    return `Gateway transaction references invoice ${result.merchantInvoiceNumber}, not order ${order.orderNumber}.`;
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
 * wins the update performs the order confirmation, and every other one sees a
 * no-match and simply reports the already-settled payment.
 */
async function settleVerifiedPayment(
  payment: IPayment,
  result: BkashPaymentStatusResult,
  actor: PaymentActor,
  /** Appended to the audit note when the scheduler, not the customer's own callback, resolved this. */
  reconciliationNote?: string
): Promise<IPayment> {
  const settled = await PaymentModel.findOneAndUpdate(
    { _id: payment._id, status: { $in: ["initiated", "pending"] } },
    {
      $set: {
        status: "paid",
        transactionId: result.trxID,
        paidAt: new Date(),
        gatewayMetadata: safeMetadata(result),
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
    },
    note: `bKash payment verified for order ${settled.merchantInvoiceNumber} (৳${settled.amountBDT}).${
      reconciliationNote ? ` ${reconciliationNote}` : ""
    }`,
  });

  return settled;
}

async function loadOwnPaymentByGatewayId(paymentID: string, actor: PaymentActor): Promise<IPayment> {
  const payment = await PaymentModel.findOne({ gatewayPaymentId: paymentID });
  // A fabricated or foreign paymentID reads identically to a missing one —
  // there is nothing to learn from probing this endpoint.
  if (!payment || payment.customer.toString() !== actor.id) {
    throw ApiError.notFound("Payment not found");
  }
  return payment;
}

/**
 * Step 2 of the bKash flow, called when the customer returns from the hosted
 * checkout page. The browser only supplies bKash's `paymentID`; the backend
 * executes it against bKash, checks the result against the stored order, and
 * only then marks anything paid — a frontend that simply claims success gets
 * nowhere.
 */
export async function executeBkashPaymentForOrder(paymentID: string, actor: PaymentActor) {
  const payment = await loadOwnPaymentByGatewayId(paymentID, actor);

  // Already settled: return it unchanged. This is the refresh/replay path and
  // must stay a success, not an error, or a customer reloading the callback
  // page would be told their completed payment failed.
  if (payment.status === "paid") {
    const order = await OrderModel.findById(payment.order);
    return { payment, order };
  }
  if (payment.status === "failed" || payment.status === "cancelled" || payment.status === "refunded") {
    throw ApiError.badRequest(
      `This payment is already ${payment.status} and cannot be completed. Please start a new payment.`
    );
  }

  const order = await OrderModel.findById(payment.order);
  if (!order) throw ApiError.notFound("Order not found");

  assertTransition(payment.status, "pending");
  payment.status = "pending";
  await payment.save();

  // `execute` can only be consumed once per bKash payment, so a replayed
  // callback falls back to querying the payment's authoritative state — a
  // genuinely completed payment is still recognised the second time around.
  let result = await executeBkashPayment(paymentID);
  if (result.transactionStatus !== "Completed") {
    result = await queryBkashPayment(paymentID);
  }

  const failure = verificationFailureReason(result, payment, order);
  if (failure) {
    const isCustomerCancellation =
      result.transactionStatus === "Cancelled" || result.statusCode === "2062";
    await rejectVerification(
      payment,
      order,
      actor,
      failure,
      result,
      isCustomerCancellation ? "cancelled" : "failed"
    );
  }

  const settled = await settleVerifiedPayment(payment, result, actor);
  const updatedOrder = await OrderModel.findById(settled.order);
  return { payment: settled, order: updatedOrder };
}

/**
 * The customer abandoned the bKash page. Nothing is verified here — this only
 * closes out a payment record that never completed, so the order can be paid
 * for again with a fresh attempt.
 */
export async function cancelBkashPaymentForOrder(paymentID: string, actor: PaymentActor, reason?: string) {
  const payment = await loadOwnPaymentByGatewayId(paymentID, actor);

  if (payment.status === "cancelled") return payment;
  if (payment.status === "paid") {
    throw ApiError.badRequest("This payment has already completed and cannot be cancelled");
  }
  assertTransition(payment.status, "cancelled");

  payment.status = "cancelled";
  payment.failureReason = reason ?? "Cancelled by the customer on the bKash page";
  await payment.save();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "payment.cancelled",
    resource: "Payment",
    resourceId: payment._id.toString(),
    newValue: { orderNumber: payment.merchantInvoiceNumber, amountBDT: payment.amountBDT },
    note: payment.failureReason,
  });

  return payment;
}

/**
 * Reconciles one payment left unresolved because the customer's browser never
 * made it back to the callback — a closed tab, a dead connection, a crash
 * mid-redirect. bKash may well have taken the money, and nothing else in the
 * system would ever notice.
 *
 * This runs from the scheduler, never from a human action: it asks bKash for
 * the authoritative state and applies exactly the same verification and
 * settling path as the customer flow, so it can only confirm what bKash
 * already agrees is complete. There is deliberately no way for a staff member
 * to mark a payment paid by hand.
 *
 * The audit entry is attributed to the customer who initiated the payment —
 * `AuditLog.actor` is a real user reference and this is their transaction; the
 * note records that the scheduler, not a person, resolved it.
 */
async function reconcileOnePayment(payment: IPayment): Promise<void> {
  const actor: PaymentActor = { id: payment.initiatedBy.toString(), role: "customer" };
  const order = await OrderModel.findById(payment.order);
  if (!order) return;

  const result = await queryBkashPayment(payment.gatewayPaymentId);
  const ageMs = Date.now() - payment.createdAt.getTime();

  if (result.transactionStatus === "Completed") {
    const failure = verificationFailureReason(result, payment, order);
    if (failure) {
      await applyRejection(payment, order, actor, failure, result, "failed");
      return;
    }
    await settleVerifiedPayment(payment, result, actor, "Reconciled automatically after an incomplete callback.");
    return;
  }

  if (result.transactionStatus === "Cancelled") {
    await applyRejection(
      payment,
      order,
      actor,
      "Customer cancelled the payment on bKash; detected by automatic reconciliation.",
      result,
      "cancelled"
    );
    return;
  }

  // Still unfinished at the gateway. Left alone until it is past any chance of
  // completing, so a customer who is merely slow on the bKash page is never
  // failed out from under themselves.
  if (ageMs >= PAYMENT_ABANDON_AFTER_MS) {
    await applyRejection(
      payment,
      order,
      actor,
      `Payment abandoned — bKash still reported it as "${result.transactionStatus ?? "unknown"}" well past the checkout window.`,
      result,
      "failed"
    );
  }
}

/**
 * The scheduler's payment tick. Sweeps every payment still sitting in
 * `initiated`/`pending` past the grace window and resolves it against bKash.
 * Verification is entirely automatic — this is what makes a manual
 * staff "re-verify" action unnecessary.
 *
 * Never throws: one unreachable gateway call must not stop the sweep, nor
 * take the scheduler down with it. Returns how many payments were resolved,
 * for the caller's logging and for tests.
 */
export async function reconcileStalePayments(): Promise<number> {
  if (!isBkashConfigured) return 0;

  const stale = await PaymentModel.find({
    provider: "bkash",
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
 * for staff. Ownership is checked by the caller (see the controller) — a
 * customer only ever reaches their own orders.
 *
 * A settled payment always wins over a superseded attempt: retries leave
 * cancelled records behind that are newer than the one that actually paid.
 */
export async function getPaymentForOrder(orderId: string) {
  const settled = await PaymentModel.findOne({
    order: orderId,
    status: { $in: ["paid", "refunded"] },
  }).sort({ createdAt: -1 });
  if (settled) return settled;
  return PaymentModel.findOne({ order: orderId }).sort({ createdAt: -1 });
}

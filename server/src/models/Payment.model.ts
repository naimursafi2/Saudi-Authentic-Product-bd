import { Schema, model, type Document, type Model, type Types } from "mongoose";

/**
 * Gateway providers a payment record can belong to. Only `bkash` exists today
 * — `cod` deliberately has no record here, because a cash-on-delivery order
 * has no gateway transaction to reconcile and is fully described by
 * `Order.paymentMethod`/`Order.isPaid` already.
 *
 * Adding a future gateway is: a value here, a provider client alongside
 * `config/bkash.ts`, and a branch in `payment.service.ts`. Nothing in the
 * order pipeline is hardcoded around bKash, so no order/inventory code
 * changes.
 */
export const PAYMENT_PROVIDERS = ["bkash"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

/**
 * Payment lifecycle. `unpaid` is the state an order starts in; `initiated`
 * means a gateway payment has been created but the customer hasn't finished
 * on the gateway's page; `pending` means the customer came back and
 * verification is in flight; `paid` is set only after the backend itself
 * verified the transaction with the gateway AND matched the amount.
 */
export const PAYMENT_STATUSES = [
  "unpaid",
  "initiated",
  "pending",
  "paid",
  "failed",
  "cancelled",
  "refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * Which statuses each status may move into. Enforced in the service on every
 * write, so a replayed callback can never walk `paid` back to `pending`, and
 * a cancelled payment can never later become paid.
 */
export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  unpaid: ["initiated", "paid", "cancelled"],
  initiated: ["pending", "paid", "failed", "cancelled"],
  pending: ["paid", "failed", "cancelled"],
  paid: ["refunded"],
  failed: [],
  cancelled: [],
  refunded: [],
};

export interface IPayment extends Document {
  _id: Types.ObjectId;
  order: Types.ObjectId;
  customer: Types.ObjectId;
  provider: PaymentProvider;
  /** Always the server-computed order total at creation time — never a client-supplied figure. */
  amountBDT: number;
  currency: string;
  status: PaymentStatus;
  /** The gateway's own payment identifier (bKash `paymentID`). */
  gatewayPaymentId: string;
  /** The gateway's settled transaction id (bKash `trxID`), only once verified. */
  transactionId?: string;
  /** The order number sent to the gateway as its merchant reference — re-checked on verification. */
  merchantInvoiceNumber: string;
  paidAt?: Date;
  failureReason?: string;
  /**
   * Non-sensitive gateway response fields kept for support/reconciliation
   * (status codes, messages, the echoed amount). Never a token, credential,
   * or anything from the gateway's auth exchange — see `config/bkash.ts`.
   */
  gatewayMetadata?: Record<string, unknown>;
  initiatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, enum: PAYMENT_PROVIDERS, required: true },
    amountBDT: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "BDT" },
    status: { type: String, enum: PAYMENT_STATUSES, default: "unpaid", index: true },
    // Unique so the same gateway payment can never be recorded twice — the
    // database-level half of the idempotency guarantee in payment.service.ts.
    gatewayPaymentId: { type: String, required: true, index: true, unique: true },
    transactionId: { type: String, index: true, sparse: true },
    merchantInvoiceNumber: { type: String, required: true, index: true },
    paidAt: { type: Date },
    failureReason: { type: String, trim: true, maxlength: 500 },
    gatewayMetadata: { type: Schema.Types.Mixed },
    initiatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// The admin payment list is always sorted newest-first, optionally filtered
// by status — one compound index covers both.
paymentSchema.index({ status: 1, createdAt: -1 });

export const PaymentModel: Model<IPayment> = model<IPayment>("Payment", paymentSchema);

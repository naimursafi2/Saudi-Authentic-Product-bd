import { Schema, model, type Document, type Model, type Types } from "mongoose";
import { ORDER_STATUSES, type OrderStatus } from "../constants/orderStatus";
import { estimatedDeliveryDays } from "../constants/shipping";
import { getCachedShippingRates } from "./ShippingSettings.model";
import type { Role } from "../constants/roles";

export type { OrderStatus };

export type DeliveryMethod = "standard" | "express";
export type PaymentMethod = "cod" | "bkash" | "nagad";

/**
 * One order item's draw against a specific Purchase batch's cost basis —
 * recorded at sale time so a later cancellation/return can credit the exact
 * batch(es) it came from (see `inventory.service.ts#consumeStockForSale`/
 * `restockFromSale`). Empty when the item's cost fell back to the average of
 * prior batches or is entirely unknown (`IOrderItem.costBasisKnown: false`).
 */
export interface IOrderItemBatchConsumption {
  purchase: Types.ObjectId;
  quantity: number;
  unitCostBDT: number;
}

export interface IOrderItem {
  product: Types.ObjectId;
  productName: string;
  variantId: string;
  variantLabel: string;
  unitPriceBDT: number;
  quantity: number;
  lineTotalBDT: number;
  /**
   * The actual landed cost per unit at the moment this item was sold —
   * quantity-weighted across whichever Purchase batch(es) FIFO consumption
   * drew from, per CLAUDE.md's "Purchasing: shops, batches & flexible landed
   * costs". **Frozen at sale time, never recomputed** — a batch's own
   * `unitCostBDT` is itself derived-on-read from its cost items, and a
   * variant's batches are consumed and replenished continuously, so this is
   * the only place "what this specific unit actually cost when it sold" is
   * preserved for historical profit reporting.
   */
  unitLandedCostBDT: number;
  /** False when no purchase-batch history existed for this variant at sale time, so `unitLandedCostBDT` is 0 rather than a real figure — profit reporting should treat this item's cost as unknown, not zero. */
  costBasisKnown: boolean;
  batchConsumptions: IOrderItemBatchConsumption[];
}

export interface IShippingAddress {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  fullAddress: string;
  district: string;
  cityArea: string;
}

export interface IOrder extends Document {
  _id: Types.ObjectId;
  orderNumber: string;
  customer: Types.ObjectId;
  items: IOrderItem[];
  shippingAddress: IShippingAddress;
  deliveryMethod: DeliveryMethod;
  shippingFeeBDT: number;
  paymentMethod: PaymentMethod;
  isPaid: boolean;
  subtotalBDT: number;
  couponCode?: string;
  discountBDT: number;
  totalBDT: number;
  status: OrderStatus;
  statusHistory: {
    status: OrderStatus;
    previousStatus?: OrderStatus;
    at: Date;
    note?: string;
    changedBy: Types.ObjectId;
    changedByRole: Role;
  }[];
  /** Set when an order reaches `assigned_to_agent` — the `delivery_agent` handling it. */
  assignedAgent?: Types.ObjectId;
  /** Plaintext, `select: false` — see `order.service.ts`'s OTP flow for why. Never
   * exposed in a JSON response by default; the `toJSON` transform below strips it
   * as defense-in-depth even if some future query accidentally re-selects it. */
  otpCode?: string;
  otpGeneratedAt?: Date;
  otpExpiresAt?: Date;
  otpVerifiedAt?: Date;
  /** Incorrect `verify-otp` attempts against the *current* code — reset to 0 whenever
   * a fresh code is generated/resent, and once more on a successful verify. */
  otpAttempts: number;
  /** True only once a `delivered` transition has gone through real OTP verification
   * (never set any other way) — a durable, directly-queryable record alongside the
   * `otp_verified`/`delivered` pair already in `statusHistory`. */
  deliveryVerified: boolean;
  deliveredAt?: Date;
  /** The `delivery_agent` who completed OTP verification for this order. */
  deliveredBy?: Types.ObjectId;
  /** Set by the delivery agent on `delivered`/`delivery_failed`. */
  deliveryNotes?: string;
  /** Set by the delivery agent on `delivery_failed`. */
  failureReason?: string;
  /** Optional photo proof of delivery, uploaded by the delivery agent at the same moment OTP verification succeeds. */
  deliveryProofImage?: { url: string; publicId: string };
  createdAt: Date;
  updatedAt: Date;
  /** Derived, never stored — see `computeEstimatedDeliveryDate()`. Undefined once the order is delivered or in a terminal/branch status. */
  estimatedDeliveryDate?: Date;
  // -- Profit virtuals (computed on read, never stored — see below) --
  costOfGoodsSoldBDT: number;
  grossProfitBDT: number;
  costBasisFullyKnown: boolean;
}

const orderItemBatchConsumptionSchema = new Schema<IOrderItemBatchConsumption>(
  {
    purchase: { type: Schema.Types.ObjectId, ref: "Purchase", required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitCostBDT: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderItemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    variantId: { type: String, required: true },
    variantLabel: { type: String, required: true },
    unitPriceBDT: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotalBDT: { type: Number, required: true, min: 0 },
    unitLandedCostBDT: { type: Number, default: 0, min: 0 },
    costBasisKnown: { type: Boolean, default: false },
    batchConsumptions: { type: [orderItemBatchConsumptionSchema], default: [] },
  },
  { _id: false }
);

const shippingAddressSchema = new Schema<IShippingAddress>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    fullAddress: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    cityArea: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (v: IOrderItem[]) => Array.isArray(v) && v.length > 0,
        message: "An order must contain at least one item",
      },
    },
    shippingAddress: { type: shippingAddressSchema, required: true },
    deliveryMethod: { type: String, enum: ["standard", "express"], required: true },
    shippingFeeBDT: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ["cod", "bkash", "nagad"], required: true },
    isPaid: { type: Boolean, default: false },
    subtotalBDT: { type: Number, required: true, min: 0 },
    couponCode: { type: String, trim: true, uppercase: true },
    discountBDT: { type: Number, default: 0, min: 0 },
    totalBDT: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: "pending",
      index: true,
    },
    statusHistory: {
      type: [
        {
          status: { type: String, required: true },
          previousStatus: { type: String },
          at: { type: Date, default: Date.now },
          note: { type: String },
          changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
          changedByRole: { type: String, required: true },
        },
      ],
      default: [],
    },
    assignedAgent: { type: Schema.Types.ObjectId, ref: "User", index: true },
    otpCode: { type: String, select: false },
    otpGeneratedAt: { type: Date },
    otpExpiresAt: { type: Date },
    otpVerifiedAt: { type: Date },
    otpAttempts: { type: Number, default: 0, min: 0 },
    deliveryVerified: { type: Boolean, default: false },
    deliveredAt: { type: Date },
    deliveredBy: { type: Schema.Types.ObjectId, ref: "User" },
    deliveryNotes: { type: String, trim: true, maxlength: 1000 },
    failureReason: { type: String, trim: true, maxlength: 500 },
    deliveryProofImage: {
      url: { type: String },
      publicId: { type: String },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.otpCode;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

/** Statuses an estimate is no longer meaningful for — either already resolved or on a branch path. */
const ESTIMATE_HIDDEN_STATUSES: OrderStatus[] = [
  "delivered",
  "delivery_failed",
  "cancelled",
  "returned",
  "refunded",
];

/**
 * Calendar days from order placement to the expected delivery. Configurable
 * per delivery method in `ShippingSettings`, read here through the
 * synchronous snapshot because Mongoose virtuals cannot await — see that
 * model's cache comment for why that is safe (this is an estimate shown to
 * the customer, never a charged amount).
 */
orderSchema.virtual("estimatedDeliveryDate").get(function estimatedDeliveryDate(this: IOrder) {
  if (ESTIMATE_HIDDEN_STATUSES.includes(this.status)) return undefined;
  const rates = getCachedShippingRates();
  const date = new Date(this.createdAt);
  date.setDate(date.getDate() + estimatedDeliveryDays(this.deliveryMethod, rates));
  return date;
});

/**
 * Profit is **derived on every read, never stored** — the same reasoning as
 * `computeCouponStatus()`/Purchase's own cost virtuals: `unitLandedCostBDT`
 * is frozen per item at sale time (see `IOrderItem` above), but the totals
 * built from it should never go stale relative to the items they sum.
 *
 * `costOfGoodsSoldBDT` sums each item's frozen unit landed cost × quantity.
 * `grossProfitBDT` is net selling revenue (subtotal minus the order-level
 * discount, deliberately excluding the shipping fee — shipping is a pass-
 * through logistics charge, not merchandise revenue) minus COGS.
 * `costBasisFullyKnown` is false if any item's cost fell back to "unknown"
 * (no purchase-batch history existed for that variant at sale time), so a
 * profit report can flag the figure as a partial/estimated total rather than
 * silently treating a missing cost as zero profit-negative.
 */
// These three virtuals run on every Order `toJSON`, including on a
// **partially-selected** populated subdocument (e.g. `refund.service.ts`/
// `returnRequest.service.ts` populate `order` with just `"orderNumber
// totalBDT status"` for a list view) — `this.items`/`this.subtotalBDT`/
// `this.discountBDT` can legitimately be `undefined` in that case, so each
// virtual must degrade to a safe default rather than throwing.
orderSchema.virtual("costOfGoodsSoldBDT").get(function costOfGoodsSoldBDT(this: IOrder) {
  return (this.items ?? []).reduce((sum, item) => sum + item.unitLandedCostBDT * item.quantity, 0);
});

orderSchema.virtual("grossProfitBDT").get(function grossProfitBDT(this: IOrder) {
  const netSellingRevenueBDT = (this.subtotalBDT ?? 0) - (this.discountBDT ?? 0);
  const cogs = (this.items ?? []).reduce((sum, item) => sum + item.unitLandedCostBDT * item.quantity, 0);
  return netSellingRevenueBDT - cogs;
});

orderSchema.virtual("costBasisFullyKnown").get(function costBasisFullyKnown(this: IOrder) {
  return (this.items ?? []).every((item) => item.costBasisKnown);
});

export const OrderModel: Model<IOrder> = model<IOrder>("Order", orderSchema);

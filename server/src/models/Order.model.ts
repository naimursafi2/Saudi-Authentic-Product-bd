import { Schema, model, type Document, type Model, type Types } from "mongoose";
import { ORDER_STATUSES, type OrderStatus } from "../constants/orderStatus";
import type { Role } from "../constants/roles";

export type { OrderStatus };

export type DeliveryMethod = "standard" | "express";
export type PaymentMethod = "cod" | "bkash" | "nagad";

export interface IOrderItem {
  product: Types.ObjectId;
  productName: string;
  variantId: string;
  variantLabel: string;
  unitPriceBDT: number;
  quantity: number;
  lineTotalBDT: number;
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
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    variantId: { type: String, required: true },
    variantLabel: { type: String, required: true },
    unitPriceBDT: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotalBDT: { type: Number, required: true, min: 0 },
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

/** Calendar days from order placement to the expected delivery, by delivery method. */
export const ESTIMATED_DELIVERY_DAYS: Record<DeliveryMethod, number> = {
  standard: 5,
  express: 2,
};

orderSchema.virtual("estimatedDeliveryDate").get(function estimatedDeliveryDate(this: IOrder) {
  if (ESTIMATE_HIDDEN_STATUSES.includes(this.status)) return undefined;
  const date = new Date(this.createdAt);
  date.setDate(date.getDate() + ESTIMATED_DELIVERY_DAYS[this.deliveryMethod]);
  return date;
});

export const OrderModel: Model<IOrder> = model<IOrder>("Order", orderSchema);

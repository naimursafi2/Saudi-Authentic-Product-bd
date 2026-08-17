import { Schema, model, type Document, type Model, type Types } from "mongoose";

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

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
  statusHistory: { status: OrderStatus; at: Date; note?: string }[];
  createdAt: Date;
  updatedAt: Date;
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
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
      index: true,
    },
    statusHistory: {
      type: [
        {
          status: { type: String, required: true },
          at: { type: Date, default: Date.now },
          note: { type: String },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export const OrderModel: Model<IOrder> = model<IOrder>("Order", orderSchema);

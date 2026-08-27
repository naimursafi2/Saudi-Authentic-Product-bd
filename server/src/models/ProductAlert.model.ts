import { Schema, model, type Document, type Model, type Types } from "mongoose";

/**
 * Powers the two customer-facing "notify me" subscriptions on the product
 * page — Price Drop and Back-in-Stock alerts. One-shot: a subscription is
 * deactivated (`isActive: false`) the moment it fires, rather than repeating,
 * so a customer who wants another heads-up later just subscribes again.
 */
export const PRODUCT_ALERT_TYPES = ["price_drop", "back_in_stock"] as const;
export type ProductAlertType = (typeof PRODUCT_ALERT_TYPES)[number];

export interface IProductAlert extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  product: Types.ObjectId;
  variantId: string;
  variantLabel: string;
  type: ProductAlertType;
  /** Variant price at subscribe time — a `price_drop` alert only fires once the live price falls below this. */
  referencePriceBDT?: number;
  isActive: boolean;
  notifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const productAlertSchema = new Schema<IProductAlert>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: String, required: true },
    variantLabel: { type: String, required: true },
    type: { type: String, enum: PRODUCT_ALERT_TYPES, required: true },
    referencePriceBDT: { type: Number, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    notifiedAt: { type: Date },
  },
  { timestamps: true }
);

// The lookup every stock/price mutation needs: "who's actively watching this variant."
productAlertSchema.index({ product: 1, variantId: 1, type: 1, isActive: 1 });

export const ProductAlertModel: Model<IProductAlert> = model<IProductAlert>(
  "ProductAlert",
  productAlertSchema
);

import { Schema, model, type Document, type Model, type Types } from "mongoose";
import type { Role } from "../constants/roles";

/**
 * One additional cost attached to a purchase batch.
 *
 * **There is deliberately no category enum here.** The cost's identity is the
 * free-text `name` the person recording it types — "Customs", "Transport",
 * "Repair", "Supplier Fee", anything. Dates and watches do not share a cost
 * vocabulary, and a fixed list would have to be edited in code every time a
 * new kind of product is sourced. Do not reintroduce a predefined option list
 * for these; `Expense.category` is the fixed-taxonomy model, and it is a
 * separate concern (operational spend, not per-batch landed cost).
 */
export interface IPurchaseCostItem {
  _id?: Types.ObjectId;
  name: string;
  amountBDT: number;
  note?: string;
  /** Optional receipt/proof photo, uploaded to Cloudinary. */
  proof?: { url: string; publicId: string };
  addedBy: Types.ObjectId;
  addedAt: Date;
}

export const PURCHASE_STATUSES = [
  "draft",
  "awaiting_stock_approval",
  "received",
  "cancelled",
] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export interface IPurchase extends Document {
  _id: Types.ObjectId;
  /** Human-readable batch reference, e.g. `PUR-20260821-4821`. */
  reference: string;
  shop: Types.ObjectId;
  /** Optional catalogue link. Set it to get per-product unit-cost history and stock-on-receipt. */
  product?: Types.ObjectId;
  variantId?: string;
  variantLabel?: string;
  /** Free-text description, used when no catalogue product is linked. */
  itemName: string;
  supplierName?: string;
  purchasedAt: Date;
  quantity: number;
  unit: string;
  /** Cost of the goods themselves, before any of the custom cost items below. */
  productCostBDT: number;
  costItems: IPurchaseCostItem[];
  note?: string;
  status: PurchaseStatus;
  /** Set while a receipt's stock increase is parked in the approval queue. */
  stockPendingActionId?: Types.ObjectId;
  receivedAt?: Date;
  recordedBy: Types.ObjectId;
  recordedByRole: Role;
  createdAt: Date;
  updatedAt: Date;
  // -- Virtuals (computed on read, never stored — see below) --
  additionalCostBDT: number;
  totalLandedCostBDT: number;
  unitCostBDT: number;
}

const purchaseCostItemSchema = new Schema<IPurchaseCostItem>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    amountBDT: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true, maxlength: 500 },
    proof: {
      url: { type: String },
      publicId: { type: String },
    },
    addedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const purchaseSchema = new Schema<IPurchase>(
  {
    reference: { type: String, required: true, unique: true, trim: true },
    shop: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", index: true },
    variantId: { type: String },
    variantLabel: { type: String, trim: true },
    itemName: { type: String, required: true, trim: true, maxlength: 200 },
    supplierName: { type: String, trim: true, maxlength: 160 },
    purchasedAt: { type: Date, required: true, default: Date.now, index: true },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, trim: true, maxlength: 24, default: "pcs" },
    productCostBDT: { type: Number, required: true, min: 0 },
    costItems: { type: [purchaseCostItemSchema], default: [] },
    note: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: PURCHASE_STATUSES, default: "draft", index: true },
    stockPendingActionId: { type: Schema.Types.ObjectId, ref: "PendingAction" },
    receivedAt: { type: Date },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    recordedByRole: { type: String, required: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

/**
 * The landed-cost maths is **derived on every read, never stored** — the same
 * arrangement as `computeCouponStatus()`, and for the same reason: a stored
 * total goes stale the moment a cost item is added, edited or removed, and
 * there is no way to notice it has. Adding a cost item is the only write; the
 * totals follow automatically.
 *
 *   Product Cost + every custom cost   = Total Landed Cost
 *   Total Landed Cost / Quantity       = Actual Unit Cost
 */
purchaseSchema.virtual("additionalCostBDT").get(function additionalCost(this: IPurchase) {
  return this.costItems.reduce((sum, item) => sum + item.amountBDT, 0);
});

purchaseSchema.virtual("totalLandedCostBDT").get(function totalLandedCost(this: IPurchase) {
  return this.productCostBDT + this.costItems.reduce((sum, item) => sum + item.amountBDT, 0);
});

purchaseSchema.virtual("unitCostBDT").get(function unitCost(this: IPurchase) {
  if (!this.quantity || this.quantity <= 0) return 0;
  const total = this.productCostBDT + this.costItems.reduce((sum, item) => sum + item.amountBDT, 0);
  return total / this.quantity;
});

export const PurchaseModel: Model<IPurchase> = model<IPurchase>("Purchase", purchaseSchema);

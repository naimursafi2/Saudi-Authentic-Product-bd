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
  /** Optional catalogue link. Set it to get per-product unit-cost history and stock-on-receipt. */
  product?: Types.ObjectId;
  variantId?: string;
  variantLabel?: string;
  /**
   * The linked product's category at the time this batch was recorded
   * (auto-filled from `product.categories[0]` when a catalogue product is
   * linked and no category was given explicitly). This is a reporting field,
   * not a second source of truth — a product's own `categories[]` stays
   * authoritative; this is just what category the batch's cost is grouped
   * under, and can be set directly for a batch with no catalogue link.
   */
  category?: Types.ObjectId;
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
  /**
   * How many of this batch's `quantity` units have not yet been drawn on by
   * a sale — the batch-level counterpart to `Product.variants[].stock`'s
   * whole-variant total. Set to `quantity` the moment the batch is marked
   * `received` (see `purchase.service.ts#receivePurchase`) and decremented by
   * `inventory.service.ts#consumeStockForSale` as orders draw from it,
   * FIFO-oldest-first; a cancelled/returned order's items are credited back
   * to the exact batches they were drawn from via `restockFromSale`. `0` for
   * a batch that has not yet been received. This is deliberately **not**
   * folded into `Product.variants[].stock` as a second source of truth for
   * "how much stock exists" — it only tracks how much of *this specific
   * batch's* cost basis remains unallocated, for costing purposes.
   */
  remainingQuantity: number;
  recordedBy: Types.ObjectId;
  recordedByRole: Role;
  createdAt: Date;
  updatedAt: Date;
  // -- Virtuals (computed on read, never stored — see below) --
  additionalCostBDT: number;
  totalLandedCostBDT: number;
  unitCostBDT: number;
  soldQuantity: number;
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
    product: { type: Schema.Types.ObjectId, ref: "Product", index: true },
    variantId: { type: String },
    variantLabel: { type: String, trim: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", index: true },
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
    remainingQuantity: { type: Number, required: true, default: 0, min: 0 },
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

/** `0` until the batch is received (nothing has been allocated to sell yet). */
purchaseSchema.virtual("soldQuantity").get(function soldQuantity(this: IPurchase) {
  if (this.status !== "received") return 0;
  return Math.max(0, this.quantity - this.remainingQuantity);
});

// FIFO lookup key — `consumeStockForSale` queries exactly this shape
// (received batches of one variant, oldest received first).
purchaseSchema.index({ product: 1, variantId: 1, status: 1, receivedAt: 1 });

export const PurchaseModel: Model<IPurchase> = model<IPurchase>("Purchase", purchaseSchema);

import { Schema, model, type Document, type Model, type Types } from "mongoose";

export type InventoryLogReason =
  | "order_placed"
  | "order_cancelled"
  | "order_returned"
  | "manual_adjustment"
  | "purchase_received";

export interface IInventoryLog extends Document {
  _id: Types.ObjectId;
  product: Types.ObjectId;
  variantId: string;
  variantLabel: string;
  delta: number; // negative = stock removed, positive = stock added
  balanceAfter: number;
  reason: InventoryLogReason;
  note?: string;
  actor?: Types.ObjectId; // absent for system-generated order events
  /**
   * The specific Purchase batch this movement drew from or returned to — set
   * on `order_placed`/`order_cancelled`/`order_returned` entries that were
   * resolved against real batch history (see `inventory.service.ts#
   * consumeStockForSale`). Absent for `manual_adjustment`/`purchase_received`
   * (which are the batch's own creation/correction, not a draw against it)
   * and for the portion of a sale that had no batch history to draw from.
   */
  purchaseBatch?: Types.ObjectId;
  /** The batch's actual landed unit cost at the moment this movement was recorded — frozen here for the same reason `Order.items[].unitLandedCostBDT` is frozen (see order.service.ts). */
  unitCostBDT?: number;
  createdAt: Date;
}

const inventoryLogSchema = new Schema<IInventoryLog>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    variantId: { type: String, required: true },
    variantLabel: { type: String, required: true },
    delta: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reason: {
      type: String,
      enum: [
        "order_placed",
        "order_cancelled",
        "order_returned",
        "manual_adjustment",
        "purchase_received",
      ],
      required: true,
    },
    note: { type: String, trim: true, maxlength: 500 },
    actor: { type: Schema.Types.ObjectId, ref: "User" },
    purchaseBatch: { type: Schema.Types.ObjectId, ref: "Purchase" },
    unitCostBDT: { type: Number, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const InventoryLogModel: Model<IInventoryLog> = model<IInventoryLog>(
  "InventoryLog",
  inventoryLogSchema
);

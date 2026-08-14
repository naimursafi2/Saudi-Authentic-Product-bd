import { Schema, model, type Document, type Model, type Types } from "mongoose";

export type InventoryLogReason = "order_placed" | "order_cancelled" | "manual_adjustment";

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
      enum: ["order_placed", "order_cancelled", "manual_adjustment"],
      required: true,
    },
    note: { type: String, trim: true, maxlength: 500 },
    actor: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const InventoryLogModel: Model<IInventoryLog> = model<IInventoryLog>(
  "InventoryLog",
  inventoryLogSchema
);

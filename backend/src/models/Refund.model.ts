import { Schema, model, type Document, type Model, type Types } from "mongoose";

export const REFUND_REASON_CATEGORIES = [
  "damaged",
  "wrong_item",
  "not_as_described",
  "changed_mind",
  "other",
] as const;
export type RefundReasonCategory = (typeof REFUND_REASON_CATEGORIES)[number];

/**
 * Refund & Return Workflow (ROLES_AND_PERMISSIONS_v2.md §11):
 * pending_review (just submitted) -> Order Manager reviews ->
 * pending_approval (or rejected) -> Admin/Super Admin approves -> approved
 * (order transitions to "refunded", a linked Expense is auto-logged).
 */
export const REFUND_STATUSES = ["pending_review", "pending_approval", "approved", "rejected"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export interface IRefund extends Document {
  _id: Types.ObjectId;
  order: Types.ObjectId;
  customer: Types.ObjectId;
  reasonCategory: RefundReasonCategory;
  requestedAmountBDT: number;
  note?: string;
  status: RefundStatus;
  requestedBy: Types.ObjectId;
  requestedByRole: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNote?: string;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  linkedExpense?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const refundSchema = new Schema<IRefund>(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reasonCategory: { type: String, required: true, enum: REFUND_REASON_CATEGORIES },
    requestedAmountBDT: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: REFUND_STATUSES, default: "pending_review", index: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    requestedByRole: { type: String, required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true, maxlength: 500 },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    linkedExpense: { type: Schema.Types.ObjectId, ref: "Expense" },
  },
  { timestamps: true }
);

export const RefundModel: Model<IRefund> = model<IRefund>("Refund", refundSchema);

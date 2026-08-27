import { Schema, model, type Document, type Model, type Types } from "mongoose";
import { REFUND_REASON_CATEGORIES, type RefundReasonCategory } from "./Refund.model";

export const RETURN_REQUEST_TYPES = ["return", "exchange"] as const;
export type ReturnRequestType = (typeof RETURN_REQUEST_TYPES)[number];

export const RETURN_REQUEST_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReturnRequestStatus = (typeof RETURN_REQUEST_STATUSES)[number];

/**
 * The customer-facing "Return / Exchange Request" step that was missing
 * from the order pipeline — see CLAUDE.md's "Return / Exchange Request"
 * section. `type: "return"` is the request to move an order into the
 * existing `returned` status (which then unlocks the existing `Refund`
 * workflow); `type: "exchange"` is a request only — approving it does not
 * move the order anywhere, since there is no automated
 * exchange-fulfilment/replacement-order system in this codebase; a Super
 * Admin/Admin approving one is a staff commitment to handle the swap
 * manually (a new order, a manual stock correction), not a system action.
 */
export interface IReturnRequest extends Document {
  _id: Types.ObjectId;
  order: Types.ObjectId;
  customer: Types.ObjectId;
  type: ReturnRequestType;
  reasonCategory: RefundReasonCategory;
  note?: string;
  /** Only meaningful for `type: "exchange"` — what the customer wants instead. */
  desiredExchangeDetails?: string;
  status: ReturnRequestStatus;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const returnRequestSchema = new Schema<IReturnRequest>(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: RETURN_REQUEST_TYPES, required: true },
    reasonCategory: { type: String, required: true, enum: REFUND_REASON_CATEGORIES },
    note: { type: String, trim: true, maxlength: 500 },
    desiredExchangeDetails: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: RETURN_REQUEST_STATUSES, default: "pending", index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

export const ReturnRequestModel: Model<IReturnRequest> = model<IReturnRequest>(
  "ReturnRequest",
  returnRequestSchema
);

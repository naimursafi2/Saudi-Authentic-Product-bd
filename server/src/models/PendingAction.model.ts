import { Schema, model, type Document, type Model, type Types } from "mongoose";
import type { Role } from "../constants/roles";

/**
 * Every action type the Grant-Based Approval Workflow covers
 * (ROLES_AND_PERMISSIONS_v2.md §19). Adding a new gated action means adding
 * a value here plus registering a handler via
 * `pendingAction.service.ts#registerPendingActionHandler` — the grant/deny/
 * notification machinery itself never needs to change.
 */
export const PENDING_ACTION_TYPES = [
  "coupon.create",
  "coupon.update",
  "product.create",
  "product.delete",
  "product.stock.update",
  "inventory.adjust",
  "refund.request",
  "refund.approve",
  "expense.confirm",
  "expense.edit",
  "purchase.receive",
] as const;
export type PendingActionType = (typeof PENDING_ACTION_TYPES)[number];

export const PENDING_ACTION_STATUSES = ["pending", "granted", "denied"] as const;
export type PendingActionStatus = (typeof PENDING_ACTION_STATUSES)[number];

export interface IPendingAction extends Document {
  _id: Types.ObjectId;
  actionType: PendingActionType;
  /** The intended change, applied verbatim on grant — never edited by the reviewer. */
  payload: Record<string, unknown>;
  requestedBy: Types.ObjectId;
  requestedByRole: Role;
  status: PendingActionStatus;
  note?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNote?: string;
  /** Populated after a successful grant, for traceability back to the created/changed record. */
  resultResourceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const pendingActionSchema = new Schema<IPendingAction>(
  {
    actionType: { type: String, required: true, enum: PENDING_ACTION_TYPES, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requestedByRole: { type: String, required: true },
    status: { type: String, enum: PENDING_ACTION_STATUSES, default: "pending", index: true },
    note: { type: String, trim: true, maxlength: 500 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true, maxlength: 500 },
    resultResourceId: { type: String },
  },
  { timestamps: true }
);

export const PendingActionModel: Model<IPendingAction> = model<IPendingAction>(
  "PendingAction",
  pendingActionSchema
);

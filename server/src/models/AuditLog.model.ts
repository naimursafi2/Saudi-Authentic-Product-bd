import { Schema, model, type Document, type Model, type Types } from "mongoose";
import type { Role } from "../constants/roles";

/**
 * General-purpose, append-only audit trail for sensitive actions that aren't
 * already covered by `InventoryLog` (stock deltas) or `Order.statusHistory`
 * (order status changes) — role changes, coupon mutations, product deletion,
 * settings changes, approval-gate decisions, refund/expense approvals, etc.
 * `action`/`resource` are free-form dot-namespaced strings (e.g.
 * `"coupon.create"`, `"user.role.update"`) rather than a closed enum, since
 * new action types get added over time without touching this model.
 */
export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  actor: Types.ObjectId;
  actorRole: Role;
  action: string;
  resource: string;
  resourceId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  note?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true, index: true },
    resource: { type: String, required: true, index: true },
    resourceId: { type: String, index: true },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AuditLogModel: Model<IAuditLog> = model<IAuditLog>("AuditLog", auditLogSchema);

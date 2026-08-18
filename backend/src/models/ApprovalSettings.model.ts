import { Schema, model, type Document, type Model, type Types } from "mongoose";

/**
 * Singleton — always exactly one document, same lazily-created pattern as
 * `SiteSettings`. Holds the Super-Admin-editable numeric thresholds the
 * approval-gate system (`pendingAction.service.ts`) and Finance module check
 * against, per ROLES_AND_PERMISSIONS_v2.md §4/§7 — these must never be
 * hardcoded in business logic.
 */
export interface IApprovalSettings extends Document {
  _id: Types.ObjectId;
  /** Coupon percentage discounts at or below this are auto-approved for co_admin/admin. */
  couponAutoApprovePercent: number;
  /** Coupon percentage discounts above this can only be created directly by super_admin. */
  couponSuperAdminOnlyAbovePercent: number;
  /** Refund requests at or below this amount an admin can approve directly. */
  refundAutoApproveThresholdBDT: number;
  /** Co-admin-submitted expenses above this amount require a Super Admin grant. */
  expenseApprovalThresholdBDT: number;
  createdAt: Date;
  updatedAt: Date;
}

const approvalSettingsSchema = new Schema<IApprovalSettings>(
  {
    couponAutoApprovePercent: { type: Number, default: 10, min: 0, max: 100 },
    couponSuperAdminOnlyAbovePercent: { type: Number, default: 25, min: 0, max: 100 },
    refundAutoApproveThresholdBDT: { type: Number, default: 5000, min: 0 },
    expenseApprovalThresholdBDT: { type: Number, default: 2000, min: 0 },
  },
  { timestamps: true }
);

export const ApprovalSettingsModel: Model<IApprovalSettings> = model<IApprovalSettings>(
  "ApprovalSettings",
  approvalSettingsSchema
);

export const APPROVAL_SETTINGS_DEFAULTS: Pick<
  IApprovalSettings,
  | "couponAutoApprovePercent"
  | "couponSuperAdminOnlyAbovePercent"
  | "refundAutoApproveThresholdBDT"
  | "expenseApprovalThresholdBDT"
> = {
  couponAutoApprovePercent: 10,
  couponSuperAdminOnlyAbovePercent: 25,
  refundAutoApproveThresholdBDT: 5000,
  expenseApprovalThresholdBDT: 2000,
};

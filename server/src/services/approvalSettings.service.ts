import {
  ApprovalSettingsModel,
  APPROVAL_SETTINGS_DEFAULTS,
  type IApprovalSettings,
} from "../models/ApprovalSettings.model";
import { recordAuditLog } from "./auditLog.service";
import type { UpdateApprovalSettingsInput } from "../validators/approvalSettings.validator";
import type { Role } from "../constants/roles";

/** Singleton — lazily creates the one settings document if it doesn't exist yet. */
export async function getApprovalSettings() {
  return ApprovalSettingsModel.findOneAndUpdate(
    {},
    { $setOnInsert: APPROVAL_SETTINGS_DEFAULTS },
    { upsert: true, new: true }
  );
}

export async function updateApprovalSettings(
  input: UpdateApprovalSettingsInput,
  actor: { id: string; role: Role }
) {
  const settings = await getApprovalSettings();
  const oldValue: Partial<IApprovalSettings> = {
    couponAutoApprovePercent: settings.couponAutoApprovePercent,
    couponSuperAdminOnlyAbovePercent: settings.couponSuperAdminOnlyAbovePercent,
    refundAutoApproveThresholdBDT: settings.refundAutoApproveThresholdBDT,
    expenseApprovalThresholdBDT: settings.expenseApprovalThresholdBDT,
  };

  Object.assign(settings, input);
  await settings.save();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "approvalSettings.update",
    resource: "ApprovalSettings",
    resourceId: settings._id.toString(),
    oldValue,
    newValue: input,
  });

  return settings;
}

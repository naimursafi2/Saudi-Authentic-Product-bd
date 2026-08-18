import { z } from "zod";

export const updateApprovalSettingsSchema = z
  .object({
    couponAutoApprovePercent: z.number().min(0).max(100).optional(),
    couponSuperAdminOnlyAbovePercent: z.number().min(0).max(100).optional(),
    refundAutoApproveThresholdBDT: z.number().min(0).optional(),
    expenseApprovalThresholdBDT: z.number().min(0).optional(),
  })
  .refine(
    (data) =>
      data.couponAutoApprovePercent === undefined ||
      data.couponSuperAdminOnlyAbovePercent === undefined ||
      data.couponAutoApprovePercent <= data.couponSuperAdminOnlyAbovePercent,
    {
      message: "Auto-approve threshold cannot exceed the Super-Admin-only threshold",
      path: ["couponAutoApprovePercent"],
    }
  );

export type UpdateApprovalSettingsInput = z.infer<typeof updateApprovalSettingsSchema>;

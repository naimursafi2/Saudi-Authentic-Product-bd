import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import * as approvalSettingsService from "../services/approvalSettings.service";

export const getApprovalSettings = catchAsync(async (_req: Request, res: Response) => {
  const settings = await approvalSettingsService.getApprovalSettings();
  sendSuccess(res, 200, "Approval settings fetched", { settings });
});

export const updateApprovalSettings = catchAsync(async (req: Request, res: Response) => {
  const settings = await approvalSettingsService.updateApprovalSettings(req.body, {
    id: req.user!.id,
    role: req.user!.role,
  });
  sendSuccess(res, 200, "Approval settings updated", { settings });
});

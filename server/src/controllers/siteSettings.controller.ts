import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import * as siteSettingsService from "../services/siteSettings.service";

export const getSiteSettings = catchAsync(async (_req: Request, res: Response) => {
  const settings = await siteSettingsService.getSettings();
  sendSuccess(res, 200, "Site settings fetched", { settings });
});

export const updateSiteSettings = catchAsync(async (req: Request, res: Response) => {
  const settings = await siteSettingsService.updateSettings(req.body, req.file);
  sendSuccess(res, 200, "Site settings updated", { settings });
});

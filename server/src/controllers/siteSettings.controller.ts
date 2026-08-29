import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { actorOf } from "../utils/actor";
import { ApiError } from "../utils/ApiError";
import * as siteSettingsService from "../services/siteSettings.service";

export const getSiteSettings = catchAsync(async (_req: Request, res: Response) => {
  const settings = await siteSettingsService.getSettings();
  sendSuccess(res, 200, "Site settings fetched", { settings });
});

export const updateSiteSettings = catchAsync(async (req: Request, res: Response) => {
  const settings = await siteSettingsService.updateSettings(req.body, actorOf(req), req.file);
  sendSuccess(res, 200, "Site settings updated", { settings });
});

export const updateSiteLogo = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("Logo image is required");
  const settings = await siteSettingsService.updateLogo(req.file, {
    id: req.user!.id,
    role: req.user!.role,
  });
  sendSuccess(res, 200, "Logo updated", { settings });
});

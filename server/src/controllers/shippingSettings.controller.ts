import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import * as shippingSettingsService from "../services/shippingSettings.service";

/**
 * Public — the storefront needs the current rates to *display* an estimate on
 * the product page and at checkout. Nothing here is sensitive: these are the
 * same figures a customer sees on their order, and the server recomputes the
 * charged fee from its own copy regardless of what the browser was shown.
 */
export const getShippingSettings = catchAsync(async (_req: Request, res: Response) => {
  const settings = await shippingSettingsService.getShippingSettings();
  sendSuccess(res, 200, "Shipping settings fetched", { settings });
});

export const updateShippingSettings = catchAsync(async (req: Request, res: Response) => {
  const settings = await shippingSettingsService.updateShippingSettings(req.body, {
    id: req.user!.id,
    role: req.user!.role,
  });
  sendSuccess(res, 200, "Shipping settings updated", { settings });
});

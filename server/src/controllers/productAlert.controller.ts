import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import * as productAlertService from "../services/productAlert.service";
import type { CreateProductAlertInput } from "../validators/productAlert.validator";

export const subscribe = catchAsync(async (req: Request, res: Response) => {
  const input = req.body as CreateProductAlertInput;
  const alert = await productAlertService.subscribeToAlert(req.user!.id, input);
  sendSuccess(res, 201, "Alert created", { alert });
});

export const listMine = catchAsync(async (req: Request, res: Response) => {
  const alerts = await productAlertService.listMyAlerts(req.user!.id);
  sendSuccess(res, 200, "Alerts fetched", { alerts });
});

export const unsubscribe = catchAsync(async (req: Request, res: Response) => {
  await productAlertService.unsubscribeFromAlert(req.user!.id, paramStr(req.params.id));
  sendSuccess(res, 200, "Alert removed");
});

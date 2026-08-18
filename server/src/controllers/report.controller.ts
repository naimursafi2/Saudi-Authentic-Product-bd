import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import * as reportService from "../services/report.service";
import type { SalesSummaryQuery } from "../validators/report.validator";

export const salesSummary = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as unknown as SalesSummaryQuery;
  const sales = await reportService.getSalesSummary(query);
  sendSuccess(res, 200, "Sales summary fetched", { sales });
});

export const adminDashboard = catchAsync(async (_req: Request, res: Response) => {
  const dashboard = await reportService.getAdminDashboard();
  sendSuccess(res, 200, "Dashboard fetched", { dashboard });
});

export const employeeDashboard = catchAsync(async (req: Request, res: Response) => {
  const dashboard = await reportService.getEmployeeDashboard(req.user!.id);
  sendSuccess(res, 200, "Dashboard fetched", { dashboard });
});

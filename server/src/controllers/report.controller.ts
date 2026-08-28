import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import * as reportService from "../services/report.service";
import type { SalesSummaryQuery, SalesTimeSeriesQuery } from "../validators/report.validator";

export const salesSummary = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as unknown as SalesSummaryQuery;
  const sales = await reportService.getSalesSummary(query);
  sendSuccess(res, 200, "Sales summary fetched", { sales });
});

export const salesTimeSeries = catchAsync(async (req: Request, res: Response) => {
  const { groupBy, from, to } = req.query as unknown as SalesTimeSeriesQuery;
  const timeSeries = await reportService.getSalesTimeSeries({ from, to }, groupBy);
  sendSuccess(res, 200, "Sales time series fetched", { timeSeries });
});

export const adminDashboard = catchAsync(async (req: Request, res: Response) => {
  const dashboard = await reportService.getAdminDashboard({ id: req.user!.id, role: req.user!.role });
  sendSuccess(res, 200, "Dashboard fetched", { dashboard });
});

export const employeeDashboard = catchAsync(async (req: Request, res: Response) => {
  const dashboard = await reportService.getEmployeeDashboard(req.user!.id);
  sendSuccess(res, 200, "Dashboard fetched", { dashboard });
});

export const deliveryPerformance = catchAsync(async (_req: Request, res: Response) => {
  const agents = await reportService.getDeliveryAgentPerformance();
  sendSuccess(res, 200, "Delivery agent performance fetched", { agents });
});

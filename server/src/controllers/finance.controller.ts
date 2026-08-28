import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import * as financeService from "../services/finance.service";
import type { FinanceSummaryQuery, GrossProfitQuery, RevenueVsExpenseQuery } from "../validators/finance.validator";

export const getFinanceSummary = catchAsync(async (req: Request, res: Response) => {
  const { from, to } = req.query as unknown as FinanceSummaryQuery;
  const summary = await financeService.getFinanceSummary({ from, to });
  sendSuccess(res, 200, "Finance summary fetched", { summary });
});

export const getRevenueVsExpense = catchAsync(async (req: Request, res: Response) => {
  const { from, to, groupBy } = req.query as unknown as RevenueVsExpenseQuery;
  const timeSeries = await financeService.getRevenueVsExpenseTimeSeries({ from, to }, groupBy);
  sendSuccess(res, 200, "Revenue vs expense fetched", { timeSeries });
});

export const getGrossProfit = catchAsync(async (req: Request, res: Response) => {
  const { from, to, groupBy } = req.query as unknown as GrossProfitQuery;
  const timeSeries = await financeService.getGrossProfitTimeSeries({ from, to }, groupBy);
  sendSuccess(res, 200, "Gross profit report fetched", { timeSeries });
});

export const getInventoryValuation = catchAsync(async (_req: Request, res: Response) => {
  const valuation = await financeService.getInventoryValuation();
  sendSuccess(res, 200, "Inventory valuation fetched", valuation);
});

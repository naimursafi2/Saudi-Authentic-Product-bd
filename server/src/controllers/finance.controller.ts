import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import * as financeService from "../services/finance.service";
import type { FinanceSummaryQuery } from "../validators/finance.validator";

export const getFinanceSummary = catchAsync(async (req: Request, res: Response) => {
  const { from, to } = req.query as unknown as FinanceSummaryQuery;
  const summary = await financeService.getFinanceSummary({ from, to });
  sendSuccess(res, 200, "Finance summary fetched", { summary });
});

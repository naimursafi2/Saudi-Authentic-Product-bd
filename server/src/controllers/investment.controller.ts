import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import * as investmentService from "../services/investment.service";
import type { ListInvestmentsQuery } from "../validators/investment.validator";

export const createInvestment = catchAsync(async (req: Request, res: Response) => {
  const investment = await investmentService.createInvestment(req.body, {
    id: req.user!.id,
    role: req.user!.role,
  });
  sendSuccess(res, 201, "Investment recorded", { investment });
});

export const listInvestments = catchAsync(async (req: Request, res: Response) => {
  const { page, limit } = req.query as unknown as ListInvestmentsQuery;
  const { investments, pagination } = await investmentService.listInvestments({ page, limit });
  sendSuccess(res, 200, "Investments fetched", { investments }, { pagination });
});

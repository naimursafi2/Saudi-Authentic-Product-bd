import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import * as performanceService from "../services/performance.service";
import type { ListPerformanceReviewsQuery } from "../validators/performance.validator";

export const create = catchAsync(async (req: Request, res: Response) => {
  const review = await performanceService.createPerformanceReview(req.user!.id, req.body);
  sendSuccess(res, 201, "Performance review created", { review });
});

export const listMine = catchAsync(async (req: Request, res: Response) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const { reviews, pagination } = await performanceService.listMyPerformanceReviews(
    req.user!.id,
    page,
    limit
  );
  sendSuccess(res, 200, "Performance reviews fetched", { reviews }, { pagination });
});

export const list = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListPerformanceReviewsQuery;
  const { reviews, pagination } = await performanceService.listPerformanceReviews(query);
  sendSuccess(res, 200, "Performance reviews fetched", { reviews }, { pagination });
});

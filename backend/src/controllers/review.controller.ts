import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import * as reviewService from "../services/review.service";
import { getProductById } from "../services/product.service";

export const listReviews = catchAsync(async (req: Request, res: Response) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const { reviews, pagination } = await reviewService.listReviewsForProduct(
    paramStr(req.params.productId),
    page,
    limit
  );
  sendSuccess(res, 200, "Reviews fetched", { reviews }, { pagination });
});

export const listAllReviews = catchAsync(async (req: Request, res: Response) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const { reviews, pagination } = await reviewService.listAllReviews(page, limit);
  sendSuccess(res, 200, "Reviews fetched", { reviews }, { pagination });
});

export const listRecentReviews = catchAsync(async (req: Request, res: Response) => {
  const { limit } = req.query as unknown as { limit: number };
  const reviews = await reviewService.listRecentReviews(limit);
  sendSuccess(res, 200, "Recent reviews fetched", { reviews });
});

export const createReview = catchAsync(async (req: Request, res: Response) => {
  const productId = paramStr(req.params.productId);
  // Ensures a 404 (not a confusing validation error) if the product doesn't exist.
  await getProductById(productId);
  const review = await reviewService.createReview(productId, req.user!.id, req.body);
  sendSuccess(res, 201, "Review submitted", { review });
});

export const deleteReview = catchAsync(async (req: Request, res: Response) => {
  await reviewService.deleteReview(paramStr(req.params.id));
  sendSuccess(res, 200, "Review deleted");
});

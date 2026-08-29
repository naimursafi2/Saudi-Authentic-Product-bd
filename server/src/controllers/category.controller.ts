import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import { actorOf } from "../utils/actor";
import * as categoryService from "../services/category.service";
import type { ListCategoriesQuery } from "../validators/category.validator";

export const listCategories = catchAsync(async (req: Request, res: Response) => {
  // Already coerced to a real boolean by the `listCategoriesQuerySchema` validator.
  const { includeInactive } = req.query as unknown as ListCategoriesQuery;
  const categories = await categoryService.listCategories(includeInactive);
  sendSuccess(res, 200, "Categories fetched", { categories });
});

export const getCategory = catchAsync(async (req: Request, res: Response) => {
  const category = await categoryService.getCategoryBySlug(paramStr(req.params.slug));
  sendSuccess(res, 200, "Category fetched", { category });
});

export const createCategory = catchAsync(async (req: Request, res: Response) => {
  const category = await categoryService.createCategory(req.body, actorOf(req), req.file);
  sendSuccess(res, 201, "Category created", { category });
});

export const updateCategory = catchAsync(async (req: Request, res: Response) => {
  const category = await categoryService.updateCategory(
    paramStr(req.params.id),
    req.body,
    actorOf(req),
    req.file
  );
  sendSuccess(res, 200, "Category updated", { category });
});

export const deleteCategory = catchAsync(async (req: Request, res: Response) => {
  await categoryService.deleteCategory(paramStr(req.params.id), actorOf(req));
  sendSuccess(res, 200, "Category deleted");
});

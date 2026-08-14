import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import * as inventoryService from "../services/inventory.service";
import type { ListInventoryLogsQuery } from "../validators/inventory.validator";

export const adjustStock = catchAsync(async (req: Request, res: Response) => {
  const product = await inventoryService.adjustStock(req.user!.id, req.body);
  sendSuccess(res, 200, "Stock adjusted", { product });
});

export const listLogs = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListInventoryLogsQuery;
  const { logs, pagination } = await inventoryService.listInventoryLogs(query);
  sendSuccess(res, 200, "Inventory logs fetched", { logs }, { pagination });
});

export const lowStock = catchAsync(async (_req: Request, res: Response) => {
  const products = await inventoryService.listLowStockProducts();
  sendSuccess(res, 200, "Low stock products fetched", { products });
});

import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import * as inventoryService from "../services/inventory.service";
import type { ListInventoryLogsQuery } from "../validators/inventory.validator";

export const adjustStock = catchAsync(async (req: Request, res: Response) => {
  const result = await inventoryService.adjustStock(
    { id: req.user!.id, role: req.user!.role },
    req.body
  );
  if (result.kind === "pending") {
    sendSuccess(res, 202, "This stock change requires Super Admin approval — submitted for review", {
      pendingActionId: result.pendingActionId,
    });
    return;
  }
  sendSuccess(res, 200, "Stock adjusted");
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

export const outOfStock = catchAsync(async (_req: Request, res: Response) => {
  const products = await inventoryService.listOutOfStockProducts();
  sendSuccess(res, 200, "Out-of-stock products fetched", { products });
});

export const stockLevels = catchAsync(async (req: Request, res: Response) => {
  const { search } = req.query as unknown as { search?: string };
  const products = await inventoryService.listStockLevels(search);
  sendSuccess(res, 200, "Stock levels fetched", { products });
});

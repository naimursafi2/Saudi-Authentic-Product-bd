import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import * as shopService from "../services/shop.service";
import type { ListShopsQuery } from "../validators/shop.validator";

function actorOf(req: Request) {
  return { id: req.user!.id, role: req.user!.role, permissions: req.user!.permissions };
}

export const listShops = catchAsync(async (req: Request, res: Response) => {
  const { includeInactive } = req.query as unknown as ListShopsQuery;
  const shops = await shopService.listShops(actorOf(req), includeInactive);
  sendSuccess(res, 200, "Shops fetched", { shops });
});

export const createShop = catchAsync(async (req: Request, res: Response) => {
  const shop = await shopService.createShop(req.body, actorOf(req));
  sendSuccess(res, 201, "Shop created", { shop });
});

export const updateShop = catchAsync(async (req: Request, res: Response) => {
  const shop = await shopService.updateShop(paramStr(req.params.id), req.body, actorOf(req));
  sendSuccess(res, 200, "Shop updated", { shop });
});

export const deleteShop = catchAsync(async (req: Request, res: Response) => {
  await shopService.deleteShop(paramStr(req.params.id), actorOf(req));
  sendSuccess(res, 200, "Shop deleted");
});

export const getUserShops = catchAsync(async (req: Request, res: Response) => {
  const user = await shopService.getUserShops(paramStr(req.params.userId));
  sendSuccess(res, 200, "Shop assignment fetched", { user });
});

export const assignShops = catchAsync(async (req: Request, res: Response) => {
  const user = await shopService.assignShopsToUser(
    paramStr(req.params.userId),
    req.body,
    actorOf(req)
  );
  sendSuccess(res, 200, "Shop assignment updated", { user });
});

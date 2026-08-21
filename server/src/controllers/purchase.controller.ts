import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import * as purchaseService from "../services/purchase.service";
import type { ListPurchasesQuery } from "../validators/purchase.validator";

function actorOf(req: Request) {
  return { id: req.user!.id, role: req.user!.role, permissions: req.user!.permissions };
}

/** multer's `.any()` gives `Express.Multer.File[]`; normalise the untyped case. */
function filesOf(req: Request): Express.Multer.File[] {
  return Array.isArray(req.files) ? req.files : [];
}

export const listPurchases = catchAsync(async (req: Request, res: Response) => {
  const filter = req.query as unknown as ListPurchasesQuery;
  const { purchases, pagination } = await purchaseService.listPurchases(filter, actorOf(req));
  sendSuccess(res, 200, "Purchases fetched", { purchases }, { pagination });
});

export const getPurchase = catchAsync(async (req: Request, res: Response) => {
  const purchase = await purchaseService.getPurchase(paramStr(req.params.id), actorOf(req));
  sendSuccess(res, 200, "Purchase fetched", { purchase });
});

export const createPurchase = catchAsync(async (req: Request, res: Response) => {
  const purchase = await purchaseService.createPurchase(req.body, actorOf(req), filesOf(req));
  sendSuccess(res, 201, "Purchase recorded", { purchase });
});

export const updatePurchase = catchAsync(async (req: Request, res: Response) => {
  const purchase = await purchaseService.updatePurchase(
    paramStr(req.params.id),
    req.body,
    actorOf(req)
  );
  sendSuccess(res, 200, "Purchase updated", { purchase });
});

export const addCostItem = catchAsync(async (req: Request, res: Response) => {
  const purchase = await purchaseService.addCostItem(
    paramStr(req.params.id),
    req.body,
    actorOf(req),
    req.file
  );
  sendSuccess(res, 201, "Cost added", { purchase });
});

export const updateCostItem = catchAsync(async (req: Request, res: Response) => {
  const purchase = await purchaseService.updateCostItem(
    paramStr(req.params.id),
    paramStr(req.params.costId),
    req.body,
    actorOf(req),
    req.file
  );
  sendSuccess(res, 200, "Cost updated", { purchase });
});

export const removeCostItem = catchAsync(async (req: Request, res: Response) => {
  const purchase = await purchaseService.removeCostItem(
    paramStr(req.params.id),
    paramStr(req.params.costId),
    actorOf(req)
  );
  sendSuccess(res, 200, "Cost removed", { purchase });
});

/**
 * Responds `202` when the stock half was parked in the approval queue, so the
 * client can tell "received" apart from "waiting on a Super Admin" — the same
 * shape the other stock-gated endpoints use.
 */
export const receivePurchase = catchAsync(async (req: Request, res: Response) => {
  const result = await purchaseService.receivePurchase(
    paramStr(req.params.id),
    actorOf(req),
    req.body?.note
  );

  if (result.kind === "pending") {
    sendSuccess(res, 202, "Stock increase submitted for Super Admin approval", {
      purchase: result.purchase,
      pendingActionId: result.pendingActionId,
    });
    return;
  }

  const message =
    result.kind === "received_without_stock"
      ? "Purchase received (no catalogue stock linked)"
      : "Purchase received and stock updated";
  sendSuccess(res, 200, message, { purchase: result.purchase });
});

export const cancelPurchase = catchAsync(async (req: Request, res: Response) => {
  const purchase = await purchaseService.cancelPurchase(paramStr(req.params.id), actorOf(req));
  sendSuccess(res, 200, "Purchase cancelled", { purchase });
});

export const deletePurchase = catchAsync(async (req: Request, res: Response) => {
  await purchaseService.deletePurchase(paramStr(req.params.id), actorOf(req));
  sendSuccess(res, 200, "Purchase deleted");
});

export const getProductCostHistory = catchAsync(async (req: Request, res: Response) => {
  const history = await purchaseService.getProductCostHistory(
    paramStr(req.params.productId),
    actorOf(req)
  );
  sendSuccess(res, 200, "Cost history fetched", history);
});

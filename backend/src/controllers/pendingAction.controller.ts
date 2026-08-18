import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import * as pendingActionService from "../services/pendingAction.service";
import type { ListPendingActionsQuery } from "../validators/pendingAction.validator";

export const listPendingActions = catchAsync(async (req: Request, res: Response) => {
  const { status, actionType, page, limit } = req.query as unknown as ListPendingActionsQuery;
  const { actions, pagination } = await pendingActionService.listPendingActions({
    status,
    actionType,
    page,
    limit,
  });
  sendSuccess(res, 200, "Pending actions fetched", { actions }, { pagination });
});

export const grantPendingAction = catchAsync(async (req: Request, res: Response) => {
  const action = await pendingActionService.grantPendingAction(
    paramStr(req.params.id),
    { id: req.user!.id, role: req.user!.role },
    req.body.note
  );
  sendSuccess(res, 200, "Request granted", { action });
});

export const denyPendingAction = catchAsync(async (req: Request, res: Response) => {
  const action = await pendingActionService.denyPendingAction(
    paramStr(req.params.id),
    { id: req.user!.id, role: req.user!.role },
    req.body.note
  );
  sendSuccess(res, 200, "Request denied", { action });
});

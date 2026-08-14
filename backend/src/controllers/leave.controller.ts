import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import * as leaveService from "../services/leave.service";
import type { ListLeavesQuery } from "../validators/leave.validator";

export const create = catchAsync(async (req: Request, res: Response) => {
  const leave = await leaveService.createLeaveRequest(req.user!.id, req.body);
  sendSuccess(res, 201, "Leave request submitted", { leave });
});

export const listMine = catchAsync(async (req: Request, res: Response) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const { leaves, pagination } = await leaveService.listMyLeaves(req.user!.id, page, limit);
  sendSuccess(res, 200, "Leave requests fetched", { leaves }, { pagination });
});

export const list = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListLeavesQuery;
  const { leaves, pagination } = await leaveService.listLeaves(query);
  sendSuccess(res, 200, "Leave requests fetched", { leaves }, { pagination });
});

export const cancel = catchAsync(async (req: Request, res: Response) => {
  const leave = await leaveService.cancelLeaveRequest(paramStr(req.params.id), req.user!.id);
  sendSuccess(res, 200, "Leave request cancelled", { leave });
});

export const review = catchAsync(async (req: Request, res: Response) => {
  const leave = await leaveService.reviewLeaveRequest(paramStr(req.params.id), req.user!.id, req.body);
  sendSuccess(res, 200, `Leave request ${leave.status}`, { leave });
});

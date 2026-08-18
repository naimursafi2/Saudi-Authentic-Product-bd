import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import * as refundService from "../services/refund.service";
import type { ListRefundsQuery, ReviewRefundInput } from "../validators/refund.validator";

export const createRefund = catchAsync(async (req: Request, res: Response) => {
  const result = await refundService.createRefundRequest(req.body, { id: req.user!.id, role: req.user!.role });
  if (result.kind === "pending") {
    sendSuccess(res, 202, "This refund request requires Super Admin approval — submitted for review", {
      pendingActionId: result.pendingActionId,
    });
    return;
  }
  sendSuccess(res, 201, "Refund request submitted", { refund: result.refund });
});

export const listRefunds = catchAsync(async (req: Request, res: Response) => {
  const { status, page, limit } = req.query as unknown as ListRefundsQuery;
  const { refunds, pagination } = await refundService.listRefunds(
    { status, page, limit },
    { id: req.user!.id, role: req.user!.role }
  );
  sendSuccess(res, 200, "Refund requests fetched", { refunds }, { pagination });
});

export const reviewRefund = catchAsync(async (req: Request, res: Response) => {
  const { decision, note } = req.body as ReviewRefundInput;
  const refund = await refundService.reviewRefund(
    paramStr(req.params.id),
    { id: req.user!.id, role: req.user!.role },
    decision,
    note
  );
  sendSuccess(res, 200, "Refund request reviewed", { refund });
});

export const rejectRefund = catchAsync(async (req: Request, res: Response) => {
  const refund = await refundService.rejectRefund(
    paramStr(req.params.id),
    { id: req.user!.id, role: req.user!.role },
    req.body.note
  );
  sendSuccess(res, 200, "Refund request rejected", { refund });
});

export const approveRefund = catchAsync(async (req: Request, res: Response) => {
  const result = await refundService.approveRefund(paramStr(req.params.id), {
    id: req.user!.id,
    role: req.user!.role,
  });
  if (result.kind === "pending") {
    sendSuccess(res, 202, "This refund amount requires Super Admin approval — submitted for review", {
      pendingActionId: result.pendingActionId,
    });
    return;
  }
  sendSuccess(res, 200, "Refund approved", { refund: result.refund });
});

import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import * as returnRequestService from "../services/returnRequest.service";
import type { ListReturnRequestsQuery, ReviewReturnRequestInput } from "../validators/returnRequest.validator";

export const createReturnRequest = catchAsync(async (req: Request, res: Response) => {
  const request = await returnRequestService.createReturnRequest(req.body, {
    id: req.user!.id,
    role: req.user!.role,
  });
  sendSuccess(res, 201, "Return/exchange request submitted", { request });
});

export const listReturnRequests = catchAsync(async (req: Request, res: Response) => {
  const { status, page, limit } = req.query as unknown as ListReturnRequestsQuery;
  const { requests, pagination } = await returnRequestService.listReturnRequests(
    { status, page, limit },
    { id: req.user!.id, role: req.user!.role }
  );
  sendSuccess(res, 200, "Return/exchange requests fetched", { requests }, { pagination });
});

export const reviewReturnRequest = catchAsync(async (req: Request, res: Response) => {
  const { decision, note } = req.body as ReviewReturnRequestInput;
  const request = await returnRequestService.reviewReturnRequest(
    paramStr(req.params.id),
    { id: req.user!.id, role: req.user!.role },
    decision,
    note
  );
  sendSuccess(res, 200, "Return/exchange request reviewed", { request });
});

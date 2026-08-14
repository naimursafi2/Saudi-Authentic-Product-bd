import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import * as salaryService from "../services/salary.service";
import type { ListSalaryPaymentsQuery } from "../validators/salary.validator";

export const create = catchAsync(async (req: Request, res: Response) => {
  const payment = await salaryService.createSalaryPayment(req.user!.id, req.body);
  sendSuccess(res, 201, "Salary payment record created", { payment });
});

export const listMine = catchAsync(async (req: Request, res: Response) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const { payments, pagination } = await salaryService.listMySalaryPayments(req.user!.id, page, limit);
  sendSuccess(res, 200, "Salary payments fetched", { payments }, { pagination });
});

export const list = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListSalaryPaymentsQuery;
  const { payments, pagination } = await salaryService.listSalaryPayments(query);
  sendSuccess(res, 200, "Salary payments fetched", { payments }, { pagination });
});

export const updateStatus = catchAsync(async (req: Request, res: Response) => {
  const payment = await salaryService.updateSalaryStatus(paramStr(req.params.id), req.body);
  sendSuccess(res, 200, "Salary payment status updated", { payment });
});

export const notify = catchAsync(async (req: Request, res: Response) => {
  const payment = await salaryService.notifySalaryPayment(paramStr(req.params.id));
  sendSuccess(res, 200, "Notification sent", { payment });
});

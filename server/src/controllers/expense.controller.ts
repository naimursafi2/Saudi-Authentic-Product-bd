import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import * as expenseService from "../services/expense.service";
import type { ListExpensesQuery } from "../validators/expense.validator";

export const createExpense = catchAsync(async (req: Request, res: Response) => {
  const expense = await expenseService.createExpense(
    req.body,
    { id: req.user!.id, role: req.user!.role },
    req.file as Express.Multer.File | undefined
  );
  sendSuccess(res, 201, "Expense recorded", { expense });
});

export const listExpenses = catchAsync(async (req: Request, res: Response) => {
  const { status, category, page, limit } = req.query as unknown as ListExpensesQuery;
  const { expenses, pagination } = await expenseService.listExpenses(
    { status, category, page, limit },
    { id: req.user!.id, role: req.user!.role }
  );
  sendSuccess(res, 200, "Expenses fetched", { expenses }, { pagination });
});

export const confirmExpense = catchAsync(async (req: Request, res: Response) => {
  const expense = await expenseService.confirmExpense(
    paramStr(req.params.id),
    { id: req.user!.id, role: req.user!.role },
    req.body.note
  );
  sendSuccess(res, 200, "Expense confirmed", { expense });
});

export const rejectExpense = catchAsync(async (req: Request, res: Response) => {
  const expense = await expenseService.rejectExpense(
    paramStr(req.params.id),
    { id: req.user!.id, role: req.user!.role },
    req.body.note
  );
  sendSuccess(res, 200, "Expense rejected", { expense });
});

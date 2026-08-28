import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import * as expenseService from "../services/expense.service";
import type {
  ListExpensesQuery,
  RequestExpenseEditInput,
  UpdateExpenseInput,
} from "../validators/expense.validator";

function actorOf(req: Request) {
  return { id: req.user!.id, role: req.user!.role };
}

export const createExpense = catchAsync(async (req: Request, res: Response) => {
  const expense = await expenseService.createExpense(
    req.body,
    actorOf(req),
    req.file as Express.Multer.File | undefined
  );
  sendSuccess(res, 201, "Expense recorded", { expense });
});

export const listExpenses = catchAsync(async (req: Request, res: Response) => {
  const { status, category, month, page, limit } = req.query as unknown as ListExpensesQuery;
  const { expenses, pagination } = await expenseService.listExpenses(
    { status, category, month, page, limit },
    actorOf(req)
  );
  sendSuccess(res, 200, "Expenses fetched", { expenses }, { pagination });
});

export const getExpenseMonthSummaries = catchAsync(async (req: Request, res: Response) => {
  const months = await expenseService.getExpenseMonthSummaries(actorOf(req));
  sendSuccess(res, 200, "Monthly expense summary fetched", { months });
});

export const updateExpense = catchAsync(async (req: Request, res: Response) => {
  const body = req.body as UpdateExpenseInput;
  const expense = await expenseService.updateExpenseDirect(paramStr(req.params.id), body, actorOf(req));
  sendSuccess(res, 200, "Expense updated", { expense });
});

export const deleteExpense = catchAsync(async (req: Request, res: Response) => {
  await expenseService.deleteExpense(paramStr(req.params.id), actorOf(req));
  sendSuccess(res, 200, "Expense deleted");
});

export const requestExpenseEdit = catchAsync(async (req: Request, res: Response) => {
  const { changes, reason } = req.body as RequestExpenseEditInput;
  const result = await expenseService.requestExpenseEdit(paramStr(req.params.id), changes, reason, actorOf(req));
  sendSuccess(res, 202, "Edit request submitted for Super Admin approval", result);
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

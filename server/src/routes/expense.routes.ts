import { Router } from "express";
import * as expenseController from "../controllers/expense.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { upload } from "../middlewares/upload.middleware";
import {
  createExpenseSchema,
  listExpensesQuerySchema,
  reviewExpenseSchema,
} from "../validators/expense.validator";
import { mongoIdParamSchema } from "../validators/common.validator";

const router = Router();

router.use(authenticate);

// -- Co-Admin can submit/view own; Admin/Super Admin see + confirm/reject all. --
router.get(
  "/",
  requirePermission("expenses.view"),
  validate({ query: listExpensesQuerySchema }),
  expenseController.listExpenses
);
router.post(
  "/",
  requirePermission("expenses.create"),
  // Optional cash-memo photo — multer passes a plain JSON request straight
  // through untouched, so a caller with no receipt keeps working unchanged.
  upload.single("cashMemo"),
  validate({ body: createExpenseSchema }),
  expenseController.createExpense
);
router.patch(
  "/:id/confirm",
  requirePermission("expenses.approve"),
  validate({ params: mongoIdParamSchema, body: reviewExpenseSchema }),
  expenseController.confirmExpense
);
router.patch(
  "/:id/reject",
  requirePermission("expenses.approve"),
  validate({ params: mongoIdParamSchema, body: reviewExpenseSchema }),
  expenseController.rejectExpense
);

export default router;

import { Router } from "express";
import * as expenseController from "../controllers/expense.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { upload } from "../middlewares/upload.middleware";
import {
  createExpenseSchema,
  listExpensesQuerySchema,
  requestExpenseEditSchema,
  reviewExpenseSchema,
  updateExpenseSchema,
} from "../validators/expense.validator";
import { mongoIdParamSchema } from "../validators/common.validator";

const router = Router();

router.use(authenticate);

// -- Co-Admin submits/views own; Employee views all (read-only); Admin/Super
// Admin see + confirm/reject all. Monthly archive shares the same scoping. --
router.get(
  "/",
  requirePermission("expenses.view"),
  validate({ query: listExpensesQuerySchema }),
  expenseController.listExpenses
);
router.get("/months", requirePermission("expenses.view"), expenseController.getExpenseMonthSummaries);
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

// -- Editing: Super Admin edits/deletes any expense directly; everyone else
// (Employee/Co-Admin/Admin) can only *request* an edit, reviewed exclusively
// through the existing super_admin-only /pending-actions grant/deny queue. --
router.patch(
  "/:id",
  requirePermission("expenses.edit"),
  validate({ params: mongoIdParamSchema, body: updateExpenseSchema }),
  expenseController.updateExpense
);
router.delete(
  "/:id",
  requirePermission("expenses.edit"),
  validate({ params: mongoIdParamSchema }),
  expenseController.deleteExpense
);
router.post(
  "/:id/edit-request",
  requirePermission("expenses.requestEdit"),
  validate({ params: mongoIdParamSchema, body: requestExpenseEditSchema }),
  expenseController.requestExpenseEdit
);

export default router;

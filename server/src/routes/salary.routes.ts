import { Router } from "express";
import * as salaryController from "../controllers/salary.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createSalaryPaymentSchema,
  listSalaryPaymentsQuerySchema,
  updateSalaryStatusSchema,
} from "../validators/salary.validator";
import { mongoIdParamSchema } from "../validators/common.validator";

const router = Router();

router.use(authenticate);

// -- Any staff member: their own payment history --
router.get("/mine", salaryController.listMine);

// -- Admin / Super Admin only (never Co-Admin) --
router.post(
  "/",
  requirePermission("salary.manage"),
  validate({ body: createSalaryPaymentSchema }),
  salaryController.create
);
router.get(
  "/",
  requirePermission("salary.view"),
  validate({ query: listSalaryPaymentsQuerySchema }),
  salaryController.list
);
router.patch(
  "/:id/status",
  requirePermission("salary.manage"),
  validate({ params: mongoIdParamSchema, body: updateSalaryStatusSchema }),
  salaryController.updateStatus
);
router.post(
  "/:id/notify",
  requirePermission("salary.manage"),
  validate({ params: mongoIdParamSchema }),
  salaryController.notify
);

export default router;

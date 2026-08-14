import { Router } from "express";
import * as salaryController from "../controllers/salary.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/rbac.middleware";
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
  authorize("admin", "super_admin"),
  validate({ body: createSalaryPaymentSchema }),
  salaryController.create
);
router.get(
  "/",
  authorize("admin", "super_admin"),
  validate({ query: listSalaryPaymentsQuerySchema }),
  salaryController.list
);
router.patch(
  "/:id/status",
  authorize("admin", "super_admin"),
  validate({ params: mongoIdParamSchema, body: updateSalaryStatusSchema }),
  salaryController.updateStatus
);
router.post(
  "/:id/notify",
  authorize("admin", "super_admin"),
  validate({ params: mongoIdParamSchema }),
  salaryController.notify
);

export default router;

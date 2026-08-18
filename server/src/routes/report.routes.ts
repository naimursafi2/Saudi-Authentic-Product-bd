import { Router } from "express";
import * as reportController from "../controllers/report.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { salesSummaryQuerySchema } from "../validators/report.validator";

const router = Router();

router.use(authenticate);

// -- Any staff member: their own dashboard snapshot --
router.get("/employee-dashboard", reportController.employeeDashboard);

// -- Admin / Co-Admin / Super Admin --
router.get(
  "/dashboard",
  authorize("admin", "super_admin", "co_admin"),
  reportController.adminDashboard
);
router.get(
  "/sales",
  authorize("admin", "super_admin", "co_admin"),
  validate({ query: salesSummaryQuerySchema }),
  reportController.salesSummary
);

export default router;

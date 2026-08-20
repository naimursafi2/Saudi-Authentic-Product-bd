import { Router } from "express";
import * as reportController from "../controllers/report.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { salesSummaryQuerySchema } from "../validators/report.validator";

const router = Router();

router.use(authenticate);

// -- Any staff member: their own dashboard snapshot --
router.get("/employee-dashboard", reportController.employeeDashboard);

// -- Admin / Co-Admin / Super Admin --
router.get(
  "/dashboard",
  requirePermission("reports.view"),
  reportController.adminDashboard
);
router.get(
  "/sales",
  requirePermission("reports.view"),
  validate({ query: salesSummaryQuerySchema }),
  reportController.salesSummary
);

export default router;

import { Router } from "express";
import * as financeController from "../controllers/finance.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { financeSummaryQuerySchema } from "../validators/finance.validator";

const router = Router();

// -- Admin/Super Admin only — co_admin's finance visibility is off by
// default per ROLES_AND_PERMISSIONS_v2.md §6 ("off by default"). --
router.get(
  "/summary",
  authenticate,
  requirePermission("finance.view"),
  validate({ query: financeSummaryQuerySchema }),
  financeController.getFinanceSummary
);

export default router;

import { Router } from "express";
import * as approvalSettingsController from "../controllers/approvalSettings.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { updateApprovalSettingsSchema } from "../validators/approvalSettings.validator";

const router = Router();

// -- Super Admin only — these thresholds gate the approval system itself. --
router.use(authenticate, requirePermission("approvals.manage"));

router.get("/", approvalSettingsController.getApprovalSettings);
router.patch(
  "/",
  validate({ body: updateApprovalSettingsSchema }),
  approvalSettingsController.updateApprovalSettings
);

export default router;

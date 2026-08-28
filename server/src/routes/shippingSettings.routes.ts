import { Router } from "express";
import * as shippingSettingsController from "../controllers/shippingSettings.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { updateShippingSettingsSchema } from "../validators/shippingSettings.validator";

const router = Router();

// -- Public: the storefront displays the current rates. Read-only; the charged
// fee is always recomputed server-side from this same source. --
router.get("/", shippingSettingsController.getShippingSettings);

// -- Admin / Super Admin — reuses the existing `settings.manage` permission
// rather than introducing a new one, so the roles that already administer
// store settings pick this up with no role-document change. --
router.patch(
  "/",
  authenticate,
  requirePermission("settings.manage"),
  validate({ body: updateShippingSettingsSchema }),
  shippingSettingsController.updateShippingSettings
);

export default router;

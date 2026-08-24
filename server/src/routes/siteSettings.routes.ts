import { Router } from "express";
import * as siteSettingsController from "../controllers/siteSettings.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { upload } from "../middlewares/upload.middleware";
import { parseMultipartJsonFields } from "../middlewares/parseMultipartJson.middleware";
import { updateSiteSettingsSchema } from "../validators/siteSettings.validator";

const router = Router();

// -- Public --
router.get("/", siteSettingsController.getSiteSettings);

// -- Admin / Super Admin only --
router.patch(
  "/",
  authenticate,
  requirePermission("settings.manage"),
  upload.single("logo"),
  parseMultipartJsonFields(["socialLinks"]),
  validate({ body: updateSiteSettingsSchema }),
  siteSettingsController.updateSiteSettings
);

// -- Logo only — also reachable by Co-Admin, who lacks "settings.manage" --
router.patch(
  "/logo",
  authenticate,
  requirePermission("settings.manage", "content.branding.manage"),
  upload.single("logo"),
  siteSettingsController.updateSiteLogo
);

export default router;

import { Router } from "express";
import * as siteSettingsController from "../controllers/siteSettings.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { upload } from "../middlewares/upload.middleware";
import { updateSiteSettingsSchema } from "../validators/siteSettings.validator";

const router = Router();

// -- Public --
router.get("/", siteSettingsController.getSiteSettings);

// -- Admin / Super Admin only --
router.patch(
  "/",
  authenticate,
  authorize("admin", "super_admin"),
  upload.single("logo"),
  validate({ body: updateSiteSettingsSchema }),
  siteSettingsController.updateSiteSettings
);

export default router;

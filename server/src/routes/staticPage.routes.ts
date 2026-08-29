import { Router } from "express";
import * as staticPageController from "../controllers/staticPage.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { upload } from "../middlewares/upload.middleware";
import { parseMultipartJsonFields } from "../middlewares/parseMultipartJson.middleware";
import { staticPageTypeParamSchema, updateStaticPageSchema } from "../validators/staticPage.validator";

const router = Router();

// -- Public --
router.get("/", staticPageController.listPages);
router.get("/:type", validate({ params: staticPageTypeParamSchema }), staticPageController.getPage);

// -- Admin / Super Admin (all pages), Co-Admin (Return & Refund Policy only).
// Which pages each key actually reaches is enforced in the service — see
// staticPage.service.ts#assertMayEditPage. --
router.patch(
  "/:type",
  authenticate,
  requirePermission("content.pages.manage", "content.refundPolicy.manage"),
  upload.single("heroImage"),
  parseMultipartJsonFields(["blocks"]),
  validate({ params: staticPageTypeParamSchema, body: updateStaticPageSchema }),
  staticPageController.updatePage
);

export default router;

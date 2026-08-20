import { Router } from "express";
import * as homepageSectionController from "../controllers/homepageSection.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { upload } from "../middlewares/upload.middleware";
import { parseMultipartJsonFields } from "../middlewares/parseMultipartJson.middleware";
import {
  createHomepageSectionSchema,
  listHomepageSectionsQuerySchema,
  updateHomepageSectionSchema,
} from "../validators/homepageSection.validator";
import { mongoIdParamSchema } from "../validators/common.validator";

const router = Router();

// -- Public --
router.get("/", validate({ query: listHomepageSectionsQuerySchema }), homepageSectionController.listSections);

// -- Admin / Super Admin / Co-Admin can create + update; delete stays Admin / Super Admin only --
router.post(
  "/",
  authenticate,
  requirePermission("content.homepage.manage"),
  upload.single("image"),
  validate({ body: createHomepageSectionSchema }),
  homepageSectionController.createSection
);
router.patch(
  "/:id",
  authenticate,
  requirePermission("content.homepage.manage"),
  upload.single("image"),
  parseMultipartJsonFields(["blocks"]),
  validate({ params: mongoIdParamSchema, body: updateHomepageSectionSchema }),
  homepageSectionController.updateSection
);
router.delete(
  "/:id",
  authenticate,
  requirePermission("content.homepage.delete"),
  validate({ params: mongoIdParamSchema }),
  homepageSectionController.deleteSection
);

export default router;

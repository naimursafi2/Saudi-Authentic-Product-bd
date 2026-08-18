import { Router } from "express";
import * as homepageSectionController from "../controllers/homepageSection.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/rbac.middleware";
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

// -- Admin / Super Admin only --
router.post(
  "/",
  authenticate,
  authorize("admin", "super_admin"),
  upload.single("image"),
  validate({ body: createHomepageSectionSchema }),
  homepageSectionController.createSection
);
router.patch(
  "/:id",
  authenticate,
  authorize("admin", "super_admin"),
  upload.single("image"),
  parseMultipartJsonFields(["blocks"]),
  validate({ params: mongoIdParamSchema, body: updateHomepageSectionSchema }),
  homepageSectionController.updateSection
);
router.delete(
  "/:id",
  authenticate,
  authorize("admin", "super_admin"),
  validate({ params: mongoIdParamSchema }),
  homepageSectionController.deleteSection
);

export default router;

import { Router } from "express";
import * as heroSlideController from "../controllers/heroSlide.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { upload } from "../middlewares/upload.middleware";
import {
  createHeroSlideSchema,
  listHeroSlidesQuerySchema,
  updateHeroSlideSchema,
} from "../validators/heroSlide.validator";
import { mongoIdParamSchema } from "../validators/common.validator";

const router = Router();

// -- Public --
router.get("/", validate({ query: listHeroSlidesQuerySchema }), heroSlideController.listHeroSlides);

// -- Admin / Super Admin / Co-Admin can create + update; delete stays Admin / Super Admin only --
router.post(
  "/",
  authenticate,
  requirePermission("content.homepage.manage"),
  upload.single("image"),
  validate({ body: createHeroSlideSchema }),
  heroSlideController.createHeroSlide
);
router.patch(
  "/:id",
  authenticate,
  requirePermission("content.homepage.manage"),
  upload.single("image"),
  validate({ params: mongoIdParamSchema, body: updateHeroSlideSchema }),
  heroSlideController.updateHeroSlide
);
router.delete(
  "/:id",
  authenticate,
  requirePermission("content.homepage.delete"),
  validate({ params: mongoIdParamSchema }),
  heroSlideController.deleteHeroSlide
);

export default router;

import { Router } from "express";
import * as navLinkController from "../controllers/navLink.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createNavLinkSchema,
  listNavLinksQuerySchema,
  updateNavLinkSchema,
} from "../validators/navLink.validator";
import { mongoIdParamSchema } from "../validators/common.validator";

const router = Router();

// -- Public --
router.get("/", validate({ query: listNavLinksQuerySchema }), navLinkController.listNavLinks);

// -- Admin / Super Admin only --
router.post(
  "/",
  authenticate,
  authorize("admin", "super_admin"),
  validate({ body: createNavLinkSchema }),
  navLinkController.createNavLink
);
router.patch(
  "/:id",
  authenticate,
  authorize("admin", "super_admin"),
  validate({ params: mongoIdParamSchema, body: updateNavLinkSchema }),
  navLinkController.updateNavLink
);
router.delete(
  "/:id",
  authenticate,
  authorize("admin", "super_admin"),
  validate({ params: mongoIdParamSchema }),
  navLinkController.deleteNavLink
);

export default router;

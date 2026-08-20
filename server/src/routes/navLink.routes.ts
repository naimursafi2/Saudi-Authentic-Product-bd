import { Router } from "express";
import * as navLinkController from "../controllers/navLink.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
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
  requirePermission("content.navigation.manage"),
  validate({ body: createNavLinkSchema }),
  navLinkController.createNavLink
);
router.patch(
  "/:id",
  authenticate,
  requirePermission("content.navigation.manage"),
  validate({ params: mongoIdParamSchema, body: updateNavLinkSchema }),
  navLinkController.updateNavLink
);
router.delete(
  "/:id",
  authenticate,
  requirePermission("content.navigation.manage"),
  validate({ params: mongoIdParamSchema }),
  navLinkController.deleteNavLink
);

export default router;

import { Router } from "express";
import * as footerColumnController from "../controllers/footerColumn.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createFooterColumnSchema,
  listFooterColumnsQuerySchema,
  updateFooterColumnSchema,
} from "../validators/footerColumn.validator";
import { mongoIdParamSchema } from "../validators/common.validator";

const router = Router();

// -- Public --
router.get("/", validate({ query: listFooterColumnsQuerySchema }), footerColumnController.listFooterColumns);

// -- Admin / Super Admin only --
router.post(
  "/",
  authenticate,
  requirePermission("content.navigation.manage"),
  validate({ body: createFooterColumnSchema }),
  footerColumnController.createFooterColumn
);
router.patch(
  "/:id",
  authenticate,
  requirePermission("content.navigation.manage"),
  validate({ params: mongoIdParamSchema, body: updateFooterColumnSchema }),
  footerColumnController.updateFooterColumn
);
router.delete(
  "/:id",
  authenticate,
  requirePermission("content.navigation.manage"),
  validate({ params: mongoIdParamSchema }),
  footerColumnController.deleteFooterColumn
);

export default router;

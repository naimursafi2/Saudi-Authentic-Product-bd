import { Router } from "express";
import * as categoryController from "../controllers/category.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { upload } from "../middlewares/upload.middleware";
import {
  createCategorySchema,
  listCategoriesQuerySchema,
  updateCategorySchema,
} from "../validators/category.validator";
import { mongoIdParamSchema, slugParamSchema } from "../validators/common.validator";

const router = Router();

// -- Public --
router.get("/", validate({ query: listCategoriesQuerySchema }), categoryController.listCategories);
router.get("/:slug", validate({ params: slugParamSchema }), categoryController.getCategory);

// -- Admin / Co-Admin only --
router.post(
  "/",
  authenticate,
  requirePermission("categories.create"),
  upload.single("image"),
  validate({ body: createCategorySchema }),
  categoryController.createCategory
);
router.patch(
  "/:id",
  authenticate,
  requirePermission("categories.edit"),
  upload.single("image"),
  validate({ params: mongoIdParamSchema, body: updateCategorySchema }),
  categoryController.updateCategory
);
router.delete(
  "/:id",
  authenticate,
  requirePermission("categories.delete"),
  validate({ params: mongoIdParamSchema }),
  categoryController.deleteCategory
);

export default router;

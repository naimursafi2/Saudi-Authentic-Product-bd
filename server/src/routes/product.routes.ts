import { Router } from "express";
import * as productController from "../controllers/product.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { upload } from "../middlewares/upload.middleware";
import { parseMultipartJsonFields } from "../middlewares/parseMultipartJson.middleware";
import {
  createProductSchema,
  listProductsQuerySchema,
  updateProductSchema,
} from "../validators/product.validator";
import { mongoIdParamSchema, slugParamSchema } from "../validators/common.validator";

const router = Router();

const parseProductJsonFields = parseMultipartJsonFields([
  "categories",
  "variants",
  "highlights",
  "existingImages",
]);

// -- Public --
router.get("/", validate({ query: listProductsQuerySchema }), productController.listProducts);
router.get("/:slug", validate({ params: slugParamSchema }), productController.getProduct);

// -- Admin / Co-Admin only --
router.get(
  "/admin/:id",
  authenticate,
  requirePermission("products.view"),
  validate({ params: mongoIdParamSchema }),
  productController.getProductForAdmin
);
router.post(
  "/",
  authenticate,
  requirePermission("products.create"),
  upload.array("images", 6),
  parseProductJsonFields,
  validate({ body: createProductSchema }),
  productController.createProduct
);
router.patch(
  "/:id",
  authenticate,
  requirePermission("products.edit"),
  upload.array("images", 6),
  parseProductJsonFields,
  validate({ params: mongoIdParamSchema, body: updateProductSchema }),
  productController.updateProduct
);
// `admin` deliberately excluded — per ROLES_AND_PERMISSIONS_v2.md §6, Admin
// has no product-deletion access at all. `co_admin` can only request
// deletion (routed through the approval gate in product.service.ts);
// `super_admin` deletes directly.
router.delete(
  "/:id",
  authenticate,
  requirePermission("products.delete"),
  validate({ params: mongoIdParamSchema }),
  productController.deleteProduct
);

export default router;

import { Router } from "express";
import * as productController from "../controllers/product.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/rbac.middleware";
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

const parseProductJsonFields = parseMultipartJsonFields(["categories", "variants", "highlights"]);

// -- Public --
router.get("/", validate({ query: listProductsQuerySchema }), productController.listProducts);
router.get("/:slug", validate({ params: slugParamSchema }), productController.getProduct);

// -- Admin / Co-Admin only --
router.get(
  "/admin/:id",
  authenticate,
  authorize("admin", "super_admin", "co_admin"),
  validate({ params: mongoIdParamSchema }),
  productController.getProductForAdmin
);
router.post(
  "/",
  authenticate,
  authorize("admin", "super_admin", "co_admin"),
  upload.array("images", 6),
  parseProductJsonFields,
  validate({ body: createProductSchema }),
  productController.createProduct
);
router.patch(
  "/:id",
  authenticate,
  authorize("admin", "super_admin", "co_admin"),
  upload.array("images", 6),
  parseProductJsonFields,
  validate({ params: mongoIdParamSchema, body: updateProductSchema }),
  productController.updateProduct
);
router.delete(
  "/:id",
  authenticate,
  authorize("admin", "super_admin"),
  validate({ params: mongoIdParamSchema }),
  productController.deleteProduct
);

export default router;

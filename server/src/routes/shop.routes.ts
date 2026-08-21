import { Router } from "express";
import * as shopController from "../controllers/shop.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  assignShopsSchema,
  createShopSchema,
  listShopsQuerySchema,
  updateShopSchema,
} from "../validators/shop.validator";
import { mongoIdParamSchema } from "../validators/common.validator";

const router = Router();

router.use(authenticate);

// Listing is scoped server-side: a caller without `shops.manage` only ever
// sees the shops in their own `User.assignedShops`.
router.get(
  "/",
  requirePermission("shops.view"),
  validate({ query: listShopsQuerySchema }),
  shopController.listShops
);

router.post(
  "/",
  requirePermission("shops.manage"),
  validate({ body: createShopSchema }),
  shopController.createShop
);
router.patch(
  "/:id",
  requirePermission("shops.manage"),
  validate({ params: mongoIdParamSchema, body: updateShopSchema }),
  shopController.updateShop
);
router.delete(
  "/:id",
  requirePermission("shops.manage"),
  validate({ params: mongoIdParamSchema }),
  shopController.deleteShop
);

// -- Per-staff shop assignment --
router.get("/users/:userId", requirePermission("shops.manage"), shopController.getUserShops);
router.patch(
  "/users/:userId",
  requirePermission("shops.manage"),
  validate({ body: assignShopsSchema }),
  shopController.assignShops
);

export default router;

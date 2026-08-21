import { Router } from "express";
import * as purchaseController from "../controllers/purchase.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { upload } from "../middlewares/upload.middleware";
import { parseMultipartJsonFields } from "../middlewares/parseMultipartJson.middleware";
import {
  costItemParamsSchema,
  costItemSchema,
  createPurchaseSchema,
  listPurchasesQuerySchema,
  receivePurchaseSchema,
  updatePurchaseSchema,
} from "../validators/purchase.validator";
import { mongoIdParamSchema, productIdParamSchema } from "../validators/common.validator";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  requirePermission("purchases.view"),
  validate({ query: listPurchasesQuerySchema }),
  purchaseController.listPurchases
);

// Landed-cost history for one product, batch by batch.
router.get(
  "/product/:productId",
  requirePermission("purchases.view"),
  validate({ params: productIdParamSchema }),
  purchaseController.getProductCostHistory
);

router.get(
  "/:id",
  requirePermission("purchases.view"),
  validate({ params: mongoIdParamSchema }),
  purchaseController.getPurchase
);

/**
 * Create. Accepts multipart so cost items supplied up front can each carry a
 * receipt image (`costProof0`, `costProof1`, ...) alongside the JSON-encoded
 * `costItems` array. `upload.any()` inherits the shared 5MB / 6-file limits;
 * a batch needing more receipts than that adds them through `POST
 * /:id/costs`, which is unlimited.
 */
router.post(
  "/",
  requirePermission("purchases.create"),
  upload.any(),
  parseMultipartJsonFields(["costItems"]),
  validate({ body: createPurchaseSchema }),
  purchaseController.createPurchase
);

router.patch(
  "/:id",
  requirePermission("purchases.edit"),
  validate({ params: mongoIdParamSchema, body: updatePurchaseSchema }),
  purchaseController.updatePurchase
);

// -- Custom cost items. Unlimited per purchase; no predefined cost types. --
router.post(
  "/:id/costs",
  requirePermission("purchases.edit"),
  upload.single("proof"),
  validate({ params: mongoIdParamSchema, body: costItemSchema }),
  purchaseController.addCostItem
);
router.patch(
  "/:id/costs/:costId",
  requirePermission("purchases.edit"),
  upload.single("proof"),
  validate({ params: costItemParamsSchema, body: costItemSchema }),
  purchaseController.updateCostItem
);
router.delete(
  "/:id/costs/:costId",
  requirePermission("purchases.edit"),
  validate({ params: costItemParamsSchema }),
  purchaseController.removeCostItem
);

// Receiving moves stock, so it runs through the same Super-Admin approval
// gate as every other stock change — see purchase.service.ts#receivePurchase.
router.patch(
  "/:id/receive",
  requirePermission("purchases.edit"),
  validate({ params: mongoIdParamSchema, body: receivePurchaseSchema }),
  purchaseController.receivePurchase
);
router.patch(
  "/:id/cancel",
  requirePermission("purchases.edit"),
  validate({ params: mongoIdParamSchema }),
  purchaseController.cancelPurchase
);

router.delete(
  "/:id",
  requirePermission("purchases.delete"),
  validate({ params: mongoIdParamSchema }),
  purchaseController.deletePurchase
);

export default router;

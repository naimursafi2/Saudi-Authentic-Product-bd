import { Router } from "express";
import * as orderController from "../controllers/order.controller";
import { authenticate, requireEmailVerified } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { upload } from "../middlewares/upload.middleware";
import {
  assignAgentSchema,
  createOrderSchema,
  deliveryFailedSchema,
  deliveryStatusSchema,
  listAssignedOrdersQuerySchema,
  listOrdersQuerySchema,
  trackOrderQuerySchema,
  updateOrderStatusSchema,
  verifyOtpSchema,
} from "../validators/order.validator";
import { mongoIdParamSchema } from "../validators/common.validator";

const router = Router();

// -- Public --
router.get("/track", validate({ query: trackOrderQuerySchema }), orderController.trackOrder);

router.use(authenticate);

// -- Customer --
router.post(
  "/",
  requireEmailVerified,
  validate({ body: createOrderSchema }),
  orderController.createOrder
);
router.get("/mine", orderController.listMyOrders);

// -- Delivery Agent (self-scoped to their own assigned orders) --
router.get(
  "/assigned-to-me",
  requirePermission("orders.deliver"),
  validate({ query: listAssignedOrdersQuerySchema }),
  orderController.listAssignedOrders
);
router.patch(
  "/:id/delivery-status",
  requirePermission("orders.deliver"),
  validate({ params: mongoIdParamSchema, body: deliveryStatusSchema }),
  orderController.updateDeliveryStatus
);
router.post(
  "/:id/send-delivery-otp",
  requirePermission("orders.deliver"),
  validate({ params: mongoIdParamSchema }),
  orderController.sendDeliveryOtp
);
router.post(
  "/:id/verify-otp",
  requirePermission("orders.deliver"),
  // Optional delivery-proof photo — multer passes plain JSON requests
  // (no `multipart/form-data` content-type) straight through untouched, so
  // the existing JSON-only caller keeps working with no change.
  upload.single("deliveryProofImage"),
  validate({ params: mongoIdParamSchema, body: verifyOtpSchema }),
  orderController.verifyDeliveryOtp
);
router.patch(
  "/:id/delivery-failed",
  requirePermission("orders.deliver"),
  validate({ params: mongoIdParamSchema, body: deliveryFailedSchema }),
  orderController.markDeliveryFailed
);

// -- Staff (Admin / Co-Admin / Super Admin / Order Manager / Employee) --
router.get(
  "/",
  requirePermission("orders.view"),
  validate({ query: listOrdersQuerySchema }),
  orderController.listOrders
);
router.patch(
  "/:id/status",
  requirePermission("orders.manage"),
  validate({ params: mongoIdParamSchema, body: updateOrderStatusSchema }),
  orderController.updateOrderStatus
);
router.patch(
  "/:id/assign-agent",
  requirePermission("orders.manage"),
  validate({ params: mongoIdParamSchema, body: assignAgentSchema }),
  orderController.assignDeliveryAgent
);

// -- Owner or staff (order-detail authorization is enforced inside the controller) --
router.get("/:id", validate({ params: mongoIdParamSchema }), orderController.getOrder);

export default router;

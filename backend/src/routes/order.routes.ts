import { Router } from "express";
import * as orderController from "../controllers/order.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createOrderSchema,
  listOrdersQuerySchema,
  trackOrderQuerySchema,
  updateOrderStatusSchema,
} from "../validators/order.validator";
import { mongoIdParamSchema } from "../validators/common.validator";

const router = Router();

// -- Public --
router.get("/track", validate({ query: trackOrderQuerySchema }), orderController.trackOrder);

router.use(authenticate);

// -- Customer --
router.post("/", validate({ body: createOrderSchema }), orderController.createOrder);
router.get("/mine", orderController.listMyOrders);

// -- Staff (Admin / Co-Admin / Super Admin / Employee) --
router.get(
  "/",
  authorize("admin", "super_admin", "co_admin", "employee"),
  validate({ query: listOrdersQuerySchema }),
  orderController.listOrders
);
router.patch(
  "/:id/status",
  authorize("admin", "super_admin", "co_admin"),
  validate({ params: mongoIdParamSchema, body: updateOrderStatusSchema }),
  orderController.updateOrderStatus
);

// -- Owner or staff (order-detail authorization is enforced inside the controller) --
router.get("/:id", validate({ params: mongoIdParamSchema }), orderController.getOrder);

export default router;

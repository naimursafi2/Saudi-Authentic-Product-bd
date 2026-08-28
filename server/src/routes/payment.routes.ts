import { Router } from "express";
import * as paymentController from "../controllers/payment.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  cancelBkashPaymentSchema,
  createBkashPaymentSchema,
  executeBkashPaymentSchema,
  listPaymentsQuerySchema,
} from "../validators/payment.validator";
import { orderIdParamSchema } from "../validators/common.validator";

const router = Router();

// -- Public: which payment providers this deployment can actually take money
// through. A boolean only — no credential, key or endpoint is exposed. --
router.get("/config", paymentController.getPaymentConfig);

router.use(authenticate);

// -- Customer (self-scoped: every handler re-checks that the order/payment
// belongs to the caller, so no permission gate is needed or wanted — same
// convention as POST /orders and GET /orders/mine). --
router.post(
  "/bkash/create",
  validate({ body: createBkashPaymentSchema }),
  paymentController.createBkashPayment
);
router.post(
  "/bkash/execute",
  validate({ body: executeBkashPaymentSchema }),
  paymentController.executeBkashPayment
);
router.post(
  "/bkash/cancel",
  validate({ body: cancelBkashPaymentSchema }),
  paymentController.cancelBkashPayment
);

// -- Staff (read-only) --
// There is deliberately no staff endpoint that settles a payment. Verification
// happens automatically: on the customer's callback, and for anyone whose
// browser never got back, on the scheduler's reconciliation sweep (see
// `payment.service.ts#reconcileStalePayments`). Nobody can mark a payment paid
// by hand.
router.get(
  "/",
  requirePermission("payments.view"),
  validate({ query: listPaymentsQuerySchema }),
  paymentController.listPayments
);
// Explains an absent bKash option at checkout. Staff-gated because it names
// server environment variables, even though it never exposes their values.
router.get(
  "/gateway-status",
  requirePermission("payments.view"),
  paymentController.getGatewayStatus
);

// -- Owner or staff (authorization is enforced inside the controller) --
router.get(
  "/order/:orderId",
  validate({ params: orderIdParamSchema }),
  paymentController.getPaymentForOrder
);

export default router;

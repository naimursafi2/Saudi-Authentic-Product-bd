import { Router } from "express";
import * as refundController from "../controllers/refund.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createRefundSchema,
  listRefundsQuerySchema,
  reviewNoteSchema,
  reviewRefundSchema,
} from "../validators/refund.validator";
import { mongoIdParamSchema } from "../validators/common.validator";

const router = Router();

router.use(authenticate);

// -- Customers request refunds on their own (returned) orders; staff can
// also submit on a customer's behalf. Co-Admin's request is gated (see
// refund.service.ts). --
router.post(
  "/",
  requirePermission("refunds.request"),
  validate({ body: createRefundSchema }),
  refundController.createRefund
);
router.get(
  "/",
  requirePermission("refunds.view"),
  validate({ query: listRefundsQuerySchema }),
  refundController.listRefunds
);
router.patch(
  "/:id/review",
  requirePermission("refunds.review"),
  validate({ params: mongoIdParamSchema, body: reviewRefundSchema }),
  refundController.reviewRefund
);
router.patch(
  "/:id/reject",
  requirePermission("refunds.review"),
  validate({ params: mongoIdParamSchema, body: reviewNoteSchema }),
  refundController.rejectRefund
);
router.patch(
  "/:id/approve",
  requirePermission("refunds.approve"),
  validate({ params: mongoIdParamSchema, body: reviewNoteSchema }),
  refundController.approveRefund
);

export default router;

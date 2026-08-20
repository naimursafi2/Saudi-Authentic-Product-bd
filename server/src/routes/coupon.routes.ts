import { Router } from "express";
import * as couponController from "../controllers/coupon.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createCouponSchema,
  listCouponsQuerySchema,
  updateCouponSchema,
  validateCouponSchema,
} from "../validators/coupon.validator";
import { mongoIdParamSchema } from "../validators/common.validator";

const router = Router();

// -- Authenticated customers (preview only — never mutates usage) --
router.post(
  "/validate",
  authenticate,
  validate({ body: validateCouponSchema }),
  couponController.validateCoupon
);

// -- Admin / Super Admin / Co-Admin — Co-Admin's create/update requests over
// the auto-approve threshold are gated through the approval system, not
// blocked at the route level (see coupon.service.ts). Deletion stays
// admin/super_admin only — the spec's approval workflow doesn't cover
// coupon deletion. --
router.get(
  "/",
  authenticate,
  requirePermission("marketing.view"),
  validate({ query: listCouponsQuerySchema }),
  couponController.listCoupons
);
router.post(
  "/",
  authenticate,
  requirePermission("marketing.manage"),
  validate({ body: createCouponSchema }),
  couponController.createCoupon
);
router.patch(
  "/:id",
  authenticate,
  requirePermission("marketing.manage"),
  validate({ params: mongoIdParamSchema, body: updateCouponSchema }),
  couponController.updateCoupon
);
router.delete(
  "/:id",
  authenticate,
  requirePermission("coupons.delete"),
  validate({ params: mongoIdParamSchema }),
  couponController.deleteCoupon
);

export default router;

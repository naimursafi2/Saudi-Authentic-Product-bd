import { Router } from "express";
import * as couponController from "../controllers/coupon.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/rbac.middleware";
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
  authorize("co_admin", "admin", "super_admin"),
  validate({ query: listCouponsQuerySchema }),
  couponController.listCoupons
);
router.post(
  "/",
  authenticate,
  authorize("co_admin", "admin", "super_admin"),
  validate({ body: createCouponSchema }),
  couponController.createCoupon
);
router.patch(
  "/:id",
  authenticate,
  authorize("co_admin", "admin", "super_admin"),
  validate({ params: mongoIdParamSchema, body: updateCouponSchema }),
  couponController.updateCoupon
);
router.delete(
  "/:id",
  authenticate,
  authorize("admin", "super_admin"),
  validate({ params: mongoIdParamSchema }),
  couponController.deleteCoupon
);

export default router;

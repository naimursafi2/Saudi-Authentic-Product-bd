import { Router } from "express";
import * as userController from "../controllers/user.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  addAddressSchema,
  createStaffSchema,
  listUsersQuerySchema,
  updateStaffMetaSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from "../validators/user.validator";
import { mongoIdParamSchema } from "../validators/common.validator";

const router = Router();

router.use(authenticate);

// -- Customer's own addresses --
router.post("/me/addresses", validate({ body: addAddressSchema }), userController.addAddress);
router.delete("/me/addresses/:addressId", userController.removeAddress);

// -- Staff management (Super Admin / Admin only) --
router.post(
  "/",
  authorize("admin", "super_admin"),
  validate({ body: createStaffSchema }),
  userController.createStaff
);
router.get(
  "/",
  authorize("admin", "super_admin", "co_admin"),
  validate({ query: listUsersQuerySchema }),
  userController.listUsers
);
router.get(
  "/:id",
  authorize("admin", "super_admin", "co_admin"),
  validate({ params: mongoIdParamSchema }),
  userController.getUser
);
router.patch(
  "/:id/role",
  authorize("admin", "super_admin"),
  validate({ params: mongoIdParamSchema, body: updateUserRoleSchema }),
  userController.updateRole
);
router.patch(
  "/:id/status",
  authorize("admin", "super_admin"),
  validate({ params: mongoIdParamSchema, body: updateUserStatusSchema }),
  userController.updateStatus
);
router.patch(
  "/:id/staff-meta",
  authorize("admin", "super_admin"),
  validate({ params: mongoIdParamSchema, body: updateStaffMetaSchema }),
  userController.updateStaffMeta
);

export default router;

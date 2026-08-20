import { Router } from "express";
import * as userController from "../controllers/user.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { upload } from "../middlewares/upload.middleware";
import {
  addAddressSchema,
  createStaffSchema,
  listUsersQuerySchema,
  updateAddressSchema,
  updateMyProfileSchema,
  updateStaffMetaSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from "../validators/user.validator";
import { mongoIdParamSchema } from "../validators/common.validator";

const router = Router();

router.use(authenticate);

// -- Customer's own profile / avatar / addresses --
router.patch("/me", validate({ body: updateMyProfileSchema }), userController.updateMyProfile);
router.patch("/me/avatar", upload.single("avatar"), userController.updateMyAvatar);
router.delete("/me/avatar", userController.removeMyAvatar);
router.post("/me/addresses", validate({ body: addAddressSchema }), userController.addAddress);
router.patch(
  "/me/addresses/:addressId",
  validate({ body: updateAddressSchema }),
  userController.updateMyAddress
);
router.delete("/me/addresses/:addressId", userController.removeAddress);

// -- Staff management (Super Admin / Admin only) --
router.post(
  "/",
  requirePermission("employees.manage"),
  validate({ body: createStaffSchema }),
  userController.createStaff
);
router.get(
  "/",
  requirePermission("employees.view"),
  validate({ query: listUsersQuerySchema }),
  userController.listUsers
);
router.get(
  "/:id",
  requirePermission("employees.view"),
  validate({ params: mongoIdParamSchema }),
  userController.getUser
);
router.patch(
  "/:id/role",
  requirePermission("employees.manage"),
  validate({ params: mongoIdParamSchema, body: updateUserRoleSchema }),
  userController.updateRole
);
router.patch(
  "/:id/status",
  requirePermission("employees.manage"),
  validate({ params: mongoIdParamSchema, body: updateUserStatusSchema }),
  userController.updateStatus
);
router.patch(
  "/:id/staff-meta",
  requirePermission("employees.manage"),
  validate({ params: mongoIdParamSchema, body: updateStaffMetaSchema }),
  userController.updateStaffMeta
);
router.patch(
  "/:id/unlock",
  requirePermission("employees.manage"),
  validate({ params: mongoIdParamSchema }),
  userController.unlockAccount
);
// Support-login. Super Admin only, and never onto another Super Admin —
// see user.service.ts#impersonateUser.
router.post(
  "/:id/impersonate",
  requirePermission("employees.impersonate"),
  validate({ params: mongoIdParamSchema }),
  userController.impersonate
);

export default router;

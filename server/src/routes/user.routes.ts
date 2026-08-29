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
  requestNidEditSchema,
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

// -- A staff member's own identity document: request a correction, never make
// one. Self-scoped by construction (the subject is always `req.user`), so it
// needs no permission — the same convention as `POST /orders`. Multer passes a
// plain-JSON request through untouched, so the scan is optional. --
router.post(
  "/me/staff-meta/nid-edit-request",
  upload.single("nidImage"),
  validate({ body: requestNidEditSchema }),
  userController.requestMyNidEdit
);

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
// Must be registered before "/:id" — otherwise "customer-stats" would be
// parsed as an :id and 400 the mongoId validator.
router.get("/customer-stats", requirePermission("employees.view"), userController.getCustomerStats);
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
  "/:id/staff-meta/nid-image",
  requirePermission("employees.manage"),
  upload.single("nidImage"),
  validate({ params: mongoIdParamSchema }),
  userController.uploadStaffNidImage
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

import { Router } from "express";
import * as roleController from "../controllers/role.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createRoleSchema, updateRoleSchema, assignRoleSchema } from "../validators/role.validator";
import { mongoIdParamSchema } from "../validators/common.validator";
import { z } from "zod";

const router = Router();

const userIdParamSchema = z.object({
  userId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid user id"),
});

router.use(authenticate);

// -- Read: anyone who can see the Roles & Permissions section --
router.get("/permissions", requirePermission("roles.view"), roleController.listPermissions);
router.get("/", requirePermission("roles.view"), roleController.listRoles);
router.get(
  "/users/:userId",
  requirePermission("roles.view", "employees.view"),
  validate({ params: userIdParamSchema }),
  roleController.getUserPermissions
);

// -- Write: role management. The service adds the guards a permission check
//    can't express on its own — no granting a permission you don't hold, no
//    editing a built-in role unless you're Super Admin, no deleting a role
//    that is still assigned. --
router.post(
  "/",
  requirePermission("roles.manage"),
  validate({ body: createRoleSchema }),
  roleController.createRole
);
router.patch(
  "/:id",
  requirePermission("roles.manage"),
  validate({ params: mongoIdParamSchema, body: updateRoleSchema }),
  roleController.updateRole
);
router.delete(
  "/:id",
  requirePermission("roles.manage"),
  validate({ params: mongoIdParamSchema }),
  roleController.deleteRole
);

/** Assigning a role to a person is staff management, not role authoring —
 * it needs `employees.manage` as well, matching the other user-mutating
 * routes in user.routes.ts. */
router.patch(
  "/users/:userId",
  requirePermission("employees.manage"),
  validate({ params: userIdParamSchema, body: assignRoleSchema }),
  roleController.assignRole
);

export default router;

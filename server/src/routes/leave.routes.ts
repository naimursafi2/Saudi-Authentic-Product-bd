import { Router } from "express";
import * as leaveController from "../controllers/leave.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createLeaveSchema, listLeavesQuerySchema, reviewLeaveSchema } from "../validators/leave.validator";
import { mongoIdParamSchema } from "../validators/common.validator";

const router = Router();

router.use(authenticate);

// -- Any staff member --
router.post("/", validate({ body: createLeaveSchema }), leaveController.create);
router.get("/mine", leaveController.listMine);
router.post(
  "/:id/cancel",
  validate({ params: mongoIdParamSchema }),
  leaveController.cancel
);

// -- Admin / Co-Admin / Super Admin --
router.get(
  "/",
  requirePermission("leave.view"),
  validate({ query: listLeavesQuerySchema }),
  leaveController.list
);
router.patch(
  "/:id/review",
  requirePermission("leave.manage"),
  validate({ params: mongoIdParamSchema, body: reviewLeaveSchema }),
  leaveController.review
);

export default router;

import { Router } from "express";
import * as pendingActionController from "../controllers/pendingAction.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  listPendingActionsQuerySchema,
  reviewPendingActionSchema,
} from "../validators/pendingAction.validator";
import { mongoIdParamSchema } from "../validators/common.validator";

const router = Router();

// -- Super Admin only — reviewing/granting/denying is exclusively theirs. --
router.use(authenticate, authorize("super_admin"));

router.get("/", validate({ query: listPendingActionsQuerySchema }), pendingActionController.listPendingActions);
router.patch(
  "/:id/grant",
  validate({ params: mongoIdParamSchema, body: reviewPendingActionSchema }),
  pendingActionController.grantPendingAction
);
router.patch(
  "/:id/deny",
  validate({ params: mongoIdParamSchema, body: reviewPendingActionSchema }),
  pendingActionController.denyPendingAction
);

export default router;

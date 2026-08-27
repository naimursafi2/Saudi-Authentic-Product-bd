import { Router } from "express";
import * as returnRequestController from "../controllers/returnRequest.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createReturnRequestSchema,
  listReturnRequestsQuerySchema,
  reviewReturnRequestSchema,
} from "../validators/returnRequest.validator";
import { mongoIdParamSchema } from "../validators/common.validator";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  requirePermission("returns.request"),
  validate({ body: createReturnRequestSchema }),
  returnRequestController.createReturnRequest
);
router.get(
  "/",
  requirePermission("returns.view"),
  validate({ query: listReturnRequestsQuerySchema }),
  returnRequestController.listReturnRequests
);
router.patch(
  "/:id/review",
  requirePermission("returns.review"),
  validate({ params: mongoIdParamSchema, body: reviewReturnRequestSchema }),
  returnRequestController.reviewReturnRequest
);

export default router;

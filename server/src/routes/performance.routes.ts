import { Router } from "express";
import * as performanceController from "../controllers/performance.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createPerformanceReviewSchema,
  listPerformanceReviewsQuerySchema,
} from "../validators/performance.validator";

const router = Router();

router.use(authenticate);

// -- Any staff member --
router.get("/mine", performanceController.listMine);

// -- Admin / Co-Admin / Super Admin --
router.post(
  "/",
  requirePermission("performance.manage"),
  validate({ body: createPerformanceReviewSchema }),
  performanceController.create
);
router.get(
  "/",
  requirePermission("performance.view"),
  validate({ query: listPerformanceReviewsQuerySchema }),
  performanceController.list
);

export default router;

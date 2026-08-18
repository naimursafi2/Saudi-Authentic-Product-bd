import { Router } from "express";
import * as performanceController from "../controllers/performance.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/rbac.middleware";
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
  authorize("admin", "super_admin", "co_admin"),
  validate({ body: createPerformanceReviewSchema }),
  performanceController.create
);
router.get(
  "/",
  authorize("admin", "super_admin", "co_admin"),
  validate({ query: listPerformanceReviewsQuerySchema }),
  performanceController.list
);

export default router;

import { Router } from "express";
import * as reviewController from "../controllers/review.controller";
import { authenticate, requireEmailVerified } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { upload } from "../middlewares/upload.middleware";
import {
  createReviewSchema,
  listRecentReviewsQuerySchema,
  listReviewsQuerySchema,
  updateReviewVisibilitySchema,
} from "../validators/review.validator";
import { mongoIdParamSchema, productIdParamSchema } from "../validators/common.validator";

const router = Router();

// -- Admin / Co-Admin / Super Admin --
router.get(
  "/",
  authenticate,
  requirePermission("reviews.view"),
  validate({ query: listReviewsQuerySchema }),
  reviewController.listAllReviews
);

// -- Public --
router.get(
  "/recent",
  validate({ query: listRecentReviewsQuerySchema }),
  reviewController.listRecentReviews
);
router.get(
  "/product/:productId",
  validate({ params: productIdParamSchema, query: listReviewsQuerySchema }),
  reviewController.listReviews
);

// -- Authenticated customers --
router.post(
  "/product/:productId",
  authenticate,
  requireEmailVerified,
  // Optional review photos — multer passes a plain JSON request straight
  // through untouched, so an existing JSON-only caller keeps working.
  upload.array("images", 4),
  validate({ params: productIdParamSchema, body: createReviewSchema }),
  reviewController.createReview
);

// -- Staff only --
router.patch(
  "/:id/visibility",
  authenticate,
  requirePermission("reviews.delete"),
  validate({ params: mongoIdParamSchema, body: updateReviewVisibilitySchema }),
  reviewController.updateReviewVisibility
);
router.delete(
  "/:id",
  authenticate,
  requirePermission("reviews.delete"),
  validate({ params: mongoIdParamSchema }),
  reviewController.deleteReview
);

export default router;

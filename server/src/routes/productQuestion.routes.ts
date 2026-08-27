import { Router } from "express";
import * as productQuestionController from "../controllers/productQuestion.controller";
import { authenticate, requireEmailVerified } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  answerProductQuestionSchema,
  createProductQuestionSchema,
  listProductQuestionsQuerySchema,
} from "../validators/productQuestion.validator";
import { mongoIdParamSchema, productIdParamSchema } from "../validators/common.validator";

const router = Router();

// -- Admin / Co-Admin / Super Admin --
router.get(
  "/",
  authenticate,
  requirePermission("productQA.view"),
  validate({ query: listProductQuestionsQuerySchema }),
  productQuestionController.listAllQuestions
);

// -- Public --
router.get(
  "/product/:productId",
  validate({ params: productIdParamSchema, query: listProductQuestionsQuerySchema }),
  productQuestionController.listQuestions
);

// -- Authenticated customers --
router.post(
  "/product/:productId",
  authenticate,
  requireEmailVerified,
  validate({ params: productIdParamSchema, body: createProductQuestionSchema }),
  productQuestionController.askQuestion
);

// -- Staff only --
router.patch(
  "/:id/answer",
  authenticate,
  requirePermission("productQA.answer"),
  validate({ params: mongoIdParamSchema, body: answerProductQuestionSchema }),
  productQuestionController.answerQuestion
);
router.delete(
  "/:id",
  authenticate,
  requirePermission("productQA.delete"),
  validate({ params: mongoIdParamSchema }),
  productQuestionController.deleteQuestion
);

export default router;

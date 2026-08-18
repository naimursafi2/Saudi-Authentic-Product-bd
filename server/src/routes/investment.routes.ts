import { Router } from "express";
import * as investmentController from "../controllers/investment.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createInvestmentSchema, listInvestmentsQuerySchema } from "../validators/investment.validator";

const router = Router();

router.use(authenticate);

// -- Investment records: Super Admin full (add+view), Admin view only. --
router.get(
  "/",
  authorize("admin", "super_admin"),
  validate({ query: listInvestmentsQuerySchema }),
  investmentController.listInvestments
);
router.post(
  "/",
  authorize("super_admin"),
  validate({ body: createInvestmentSchema }),
  investmentController.createInvestment
);

export default router;

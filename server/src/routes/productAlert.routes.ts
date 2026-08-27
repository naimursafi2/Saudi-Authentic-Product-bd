import { Router } from "express";
import * as productAlertController from "../controllers/productAlert.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createProductAlertSchema } from "../validators/productAlert.validator";
import { mongoIdParamSchema } from "../validators/common.validator";

const router = Router();

// Self-scoped to req.user.id, same as /users/me/* and /notifications/mine — no permission needed.
router.use(authenticate);

router.get("/mine", productAlertController.listMine);
router.post("/", validate({ body: createProductAlertSchema }), productAlertController.subscribe);
router.delete("/:id", validate({ params: mongoIdParamSchema }), productAlertController.unsubscribe);

export default router;

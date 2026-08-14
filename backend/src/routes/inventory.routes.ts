import { Router } from "express";
import * as inventoryController from "../controllers/inventory.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { adjustStockSchema, listInventoryLogsQuerySchema } from "../validators/inventory.validator";

const router = Router();

router.use(authenticate, authorize("admin", "super_admin", "co_admin"));

router.get("/low-stock", inventoryController.lowStock);
router.get("/logs", validate({ query: listInventoryLogsQuerySchema }), inventoryController.listLogs);
router.post("/adjust", validate({ body: adjustStockSchema }), inventoryController.adjustStock);

export default router;

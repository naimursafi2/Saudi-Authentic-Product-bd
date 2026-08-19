import { Router } from "express";
import * as inventoryController from "../controllers/inventory.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  adjustStockSchema,
  listInventoryLogsQuerySchema,
  stockLevelsQuerySchema,
} from "../validators/inventory.validator";

const router = Router();

router.use(authenticate);

// Read-only live stock, also readable by `employee` (and `order_manager`) —
// warehouse/stock-checking staff need the real count without any ability to
// change it. Everything below stays admin-tier.
router.get(
  "/stock",
  authorize("employee", "order_manager", "co_admin", "admin", "super_admin"),
  validate({ query: stockLevelsQuerySchema }),
  inventoryController.stockLevels
);

const ADMIN_TIER = authorize("admin", "super_admin", "co_admin");

router.get("/low-stock", ADMIN_TIER, inventoryController.lowStock);
router.get(
  "/logs",
  ADMIN_TIER,
  validate({ query: listInventoryLogsQuerySchema }),
  inventoryController.listLogs
);
// Applies immediately only for `super_admin`; every other role's adjustment is
// queued for approval (see inventory.service.ts#adjustStock).
router.post("/adjust", ADMIN_TIER, validate({ body: adjustStockSchema }), inventoryController.adjustStock);

export default router;

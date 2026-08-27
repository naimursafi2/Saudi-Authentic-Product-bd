import { Router } from "express";
import * as inventoryController from "../controllers/inventory.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
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
  requirePermission("inventory.view"),
  validate({ query: stockLevelsQuerySchema }),
  inventoryController.stockLevels
);

// Reading the stock history is a separate capability from changing stock, so
// the two are separate permissions rather than one shared "admin tier".
const CAN_READ_LOGS = requirePermission("inventory.logs.view");

router.get("/low-stock", CAN_READ_LOGS, inventoryController.lowStock);
router.get("/out-of-stock", CAN_READ_LOGS, inventoryController.outOfStock);
router.get(
  "/logs",
  CAN_READ_LOGS,
  validate({ query: listInventoryLogsQuerySchema }),
  inventoryController.listLogs
);
// Applies immediately only for `super_admin`; every other role's adjustment is
// queued for approval (see inventory.service.ts#adjustStock).
router.post(
  "/adjust",
  requirePermission("inventory.manage"),
  validate({ body: adjustStockSchema }),
  inventoryController.adjustStock
);

export default router;

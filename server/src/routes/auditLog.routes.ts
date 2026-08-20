import { Router } from "express";
import * as auditLogController from "../controllers/auditLog.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { listAuditLogsQuerySchema } from "../validators/auditLog.validator";

const router = Router();

// Read-only for every role — Super Admin/Admin see everything, everyone else
// is force-scoped server-side to their own actions (see auditLog.service.ts).
router.get(
  "/",
  authenticate,
  requirePermission("auditLogs.view"),
  validate({ query: listAuditLogsQuerySchema }),
  auditLogController.listAuditLogs
);

export default router;

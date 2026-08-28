import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import * as auditLogService from "../services/auditLog.service";
import type { ListAuditLogsQuery } from "../validators/auditLog.validator";

export const listAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const { resource, resourceId, page, limit } = req.query as unknown as ListAuditLogsQuery;
  const { logs, pagination } = await auditLogService.listAuditLogs(
    { resource, resourceId, page, limit },
    { id: req.user!.id, role: req.user!.role }
  );
  sendSuccess(res, 200, "Audit logs fetched", { logs }, { pagination });
});

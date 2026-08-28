import { AuditLogModel } from "../models/AuditLog.model";
import type { Role } from "../constants/roles";
import { ADMIN_PORTAL_ROLES } from "../constants/roles";

export interface RecordAuditLogInput {
  actor: string;
  actorRole: Role;
  action: string;
  resource: string;
  resourceId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  note?: string;
}

/**
 * Best-effort — a logging failure must never break the primary action it's
 * describing, so this never throws (mirrors `email.service.ts`'s `safeSend`).
 */
export async function recordAuditLog(input: RecordAuditLogInput): Promise<void> {
  try {
    await AuditLogModel.create(input);
  } catch (err) {
    console.error("[audit] failed to record audit log:", (err as Error).message);
  }
}

/**
 * `super_admin`/`admin` see every entry (per the spec: Super Admin full,
 * Admin read-only-all). Every other role is force-scoped to their own
 * actions only, regardless of any filter they pass — this is the real
 * security boundary, not just a UI default.
 */
export async function listAuditLogs(
  filter: { resource?: string; resourceId?: string; page: number; limit: number },
  viewer: { id: string; role: Role }
) {
  const query: Record<string, unknown> = {};
  if (filter.resource) query.resource = filter.resource;
  if (filter.resourceId) query.resourceId = filter.resourceId;

  const canViewAll = viewer.role === "admin" || viewer.role === "super_admin";
  if (!canViewAll) query.actor = viewer.id;

  const skip = (filter.page - 1) * filter.limit;
  const [logs, total] = await Promise.all([
    AuditLogModel.find(query)
      .populate("actor", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filter.limit),
    AuditLogModel.countDocuments(query),
  ]);

  return {
    logs,
    pagination: {
      page: filter.page,
      limit: filter.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filter.limit)),
    },
  };
}

/** Roles allowed to call `GET /audit-logs` at all — everyone else has no audit-log access. */
export const AUDIT_LOG_VIEWER_ROLES: Role[] = [...ADMIN_PORTAL_ROLES, "employee", "delivery_agent"];

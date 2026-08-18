import {
  PendingActionModel,
  type IPendingAction,
  type PendingActionType,
  type PendingActionStatus,
} from "../models/PendingAction.model";
import { UserModel } from "../models/User.model";
import { ApiError } from "../utils/ApiError";
import { recordAuditLog } from "./auditLog.service";
import { sendPendingActionRequestedEmail, sendPendingActionReviewedEmail } from "./email.service";
import type { Role } from "../constants/roles";

export interface PendingActionActor {
  id: string;
  role: Role;
}

export interface ApplyResult {
  resource: string;
  resourceId?: string;
}

type ApplyHandler = (payload: Record<string, unknown>, reviewer: PendingActionActor) => Promise<ApplyResult>;

/**
 * Each gated action type registers its own "apply" function here instead of
 * `pendingAction.service.ts` importing `coupon.service.ts`/`product.service.ts`/
 * `finance.service.ts` directly — those services import *this* module to
 * request a grant, so a direct import the other way would be circular. Every
 * owning service calls `registerPendingActionHandler(...)` once at module
 * load time (see the bottom of `coupon.service.ts` etc.); since every route
 * file — and therefore every service — is imported by `routes/index.ts` at
 * server startup, all handlers are registered before any request is handled.
 */
const handlers = new Map<PendingActionType, ApplyHandler>();

export function registerPendingActionHandler(actionType: PendingActionType, handler: ApplyHandler): void {
  handlers.set(actionType, handler);
}

/**
 * Creates a pending action and notifies every Super Admin — the action does
 * NOT take effect until a Super Admin grants it. Never called for a
 * `super_admin` requester (they always bypass the gate at the call site).
 */
export async function createPendingAction(
  actionType: PendingActionType,
  payload: Record<string, unknown>,
  requester: PendingActionActor,
  note?: string
): Promise<IPendingAction> {
  const action = await PendingActionModel.create({
    actionType,
    payload,
    requestedBy: requester.id,
    requestedByRole: requester.role,
    status: "pending",
    note,
  });

  await recordAuditLog({
    actor: requester.id,
    actorRole: requester.role,
    action: `${actionType}.request`,
    resource: "PendingAction",
    resourceId: action._id.toString(),
    newValue: payload,
    note,
  });

  const [requesterUser, superAdmins] = await Promise.all([
    UserModel.findById(requester.id),
    UserModel.find({ role: "super_admin", isActive: true }),
  ]);
  for (const admin of superAdmins) {
    void sendPendingActionRequestedEmail(admin.email, admin.name, {
      actionType,
      requestedByName: requesterUser?.name ?? "A staff member",
      note,
    });
  }

  return action;
}

export async function listPendingActions(filter: {
  status?: PendingActionStatus;
  actionType?: PendingActionType;
  page: number;
  limit: number;
}) {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.actionType) query.actionType = filter.actionType;

  const skip = (filter.page - 1) * filter.limit;
  const [actions, total] = await Promise.all([
    PendingActionModel.find(query)
      .populate("requestedBy", "name email")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filter.limit),
    PendingActionModel.countDocuments(query),
  ]);

  return {
    actions,
    pagination: {
      page: filter.page,
      limit: filter.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filter.limit)),
    },
  };
}

async function loadPendingAction(id: string): Promise<IPendingAction> {
  const action = await PendingActionModel.findById(id);
  if (!action) throw ApiError.notFound("Pending action not found");
  if (action.status !== "pending") {
    throw ApiError.badRequest(`This request has already been ${action.status}`);
  }
  return action;
}

export async function grantPendingAction(
  id: string,
  reviewer: PendingActionActor,
  reviewNote?: string
): Promise<IPendingAction> {
  const action = await loadPendingAction(id);

  const handler = handlers.get(action.actionType);
  if (!handler) {
    throw ApiError.internal(`No handler registered for action type "${action.actionType}"`);
  }
  const result = await handler(action.payload, reviewer);

  action.status = "granted";
  action.reviewedBy = reviewer.id as unknown as IPendingAction["reviewedBy"];
  action.reviewedAt = new Date();
  action.reviewNote = reviewNote;
  action.resultResourceId = result.resourceId;
  await action.save();

  await recordAuditLog({
    actor: reviewer.id,
    actorRole: reviewer.role,
    action: `${action.actionType}.grant`,
    resource: "PendingAction",
    resourceId: action._id.toString(),
    newValue: { status: "granted", resultResourceId: result.resourceId },
    note: reviewNote,
  });

  const requesterUser = await UserModel.findById(action.requestedBy);
  if (requesterUser) {
    void sendPendingActionReviewedEmail(requesterUser.email, requesterUser.name, {
      actionType: action.actionType,
      status: "granted",
      reviewNote,
    });
  }

  return action;
}

export async function denyPendingAction(
  id: string,
  reviewer: PendingActionActor,
  reviewNote?: string
): Promise<IPendingAction> {
  const action = await loadPendingAction(id);

  action.status = "denied";
  action.reviewedBy = reviewer.id as unknown as IPendingAction["reviewedBy"];
  action.reviewedAt = new Date();
  action.reviewNote = reviewNote;
  await action.save();

  await recordAuditLog({
    actor: reviewer.id,
    actorRole: reviewer.role,
    action: `${action.actionType}.deny`,
    resource: "PendingAction",
    resourceId: action._id.toString(),
    newValue: { status: "denied" },
    note: reviewNote,
  });

  const requesterUser = await UserModel.findById(action.requestedBy);
  if (requesterUser) {
    void sendPendingActionReviewedEmail(requesterUser.email, requesterUser.name, {
      actionType: action.actionType,
      status: "denied",
      reviewNote,
    });
  }

  return action;
}

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
type DenyHandler = (payload: Record<string, unknown>, reviewer: PendingActionActor) => Promise<void>;

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
/**
 * Optional cleanup for an action type whose payload already did something
 * with side effects (e.g. `product.create` uploads images to Cloudinary
 * before the request is even reviewed) that needs undoing on denial. Most
 * action types don't register one — their payload is inert until granted.
 */
const denyHandlers = new Map<PendingActionType, DenyHandler>();

export function registerPendingActionHandler(actionType: PendingActionType, handler: ApplyHandler): void {
  handlers.set(actionType, handler);
}

export function registerPendingActionDenyHandler(actionType: PendingActionType, handler: DenyHandler): void {
  denyHandlers.set(actionType, handler);
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

/** The two gated action types that write a variant's stock. */
const STOCK_ACTION_TYPES: PendingActionType[] = ["inventory.adjust", "product.stock.update"];

/**
 * Which variant ids a pending stock request would write to. Empty for every
 * other action type — only stock requests can collide with each other.
 */
function stockTargetVariantIds(action: Pick<IPendingAction, "actionType" | "payload">): string[] {
  if (action.actionType === "inventory.adjust") {
    const variantId = action.payload.variantId;
    return typeof variantId === "string" ? [variantId] : [];
  }
  if (action.actionType === "product.stock.update") {
    const stocks = (action.payload.stocks ?? []) as { variantId?: unknown }[];
    return stocks.map((s) => s.variantId).filter((id): id is string => typeof id === "string");
  }
  return [];
}

/**
 * Maps each still-pending stock request to the other still-pending requests
 * targeting a variant it also touches. Two queued changes to one variant both
 * apply in grant order — deltas compose, but absolute updates are
 * last-grant-wins — so the reviewer needs to see the overlap before granting
 * rather than discovering it afterwards. Computed across the whole queue, not
 * just the page being viewed, so pagination can't hide a conflict.
 */
async function buildStockConflictMap(): Promise<Map<string, string[]>> {
  const pendingStockActions = await PendingActionModel.find({
    status: "pending",
    actionType: { $in: STOCK_ACTION_TYPES },
  }).select("actionType payload");

  const targets = pendingStockActions.map((action) => ({
    id: action._id.toString(),
    variantIds: new Set(stockTargetVariantIds(action)),
  }));

  const conflicts = new Map<string, string[]>();
  for (const a of targets) {
    const overlapping = targets
      .filter((b) => b.id !== a.id && [...b.variantIds].some((id) => a.variantIds.has(id)))
      .map((b) => b.id);
    if (overlapping.length > 0) conflicts.set(a.id, overlapping);
  }
  return conflicts;
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
  const [actions, total, conflicts] = await Promise.all([
    PendingActionModel.find(query)
      .populate("requestedBy", "name email")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filter.limit),
    PendingActionModel.countDocuments(query),
    buildStockConflictMap(),
  ]);

  return {
    actions: actions.map((action) => ({
      ...action.toObject(),
      conflictingActionIds: conflicts.get(action._id.toString()) ?? [],
    })),
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

  // Captured before applying: once this grant lands, the other requests are
  // still pending but now race against a stock level this grant just moved.
  // Recording it leaves a permanent trace of the overlap in the audit log.
  const conflicts = STOCK_ACTION_TYPES.includes(action.actionType)
    ? ((await buildStockConflictMap()).get(action._id.toString()) ?? [])
    : [];

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

  const conflictNote =
    conflicts.length > 0
      ? `Granted while ${conflicts.length} other pending stock request(s) target the same variant: ${conflicts.join(", ")}`
      : undefined;

  await recordAuditLog({
    actor: reviewer.id,
    actorRole: reviewer.role,
    action: `${action.actionType}.grant`,
    resource: "PendingAction",
    resourceId: action._id.toString(),
    newValue: { status: "granted", resultResourceId: result.resourceId, conflictingActionIds: conflicts },
    note: [reviewNote, conflictNote].filter(Boolean).join(" — ") || undefined,
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

  const cleanup = denyHandlers.get(action.actionType);
  if (cleanup) await cleanup(action.payload, reviewer);

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

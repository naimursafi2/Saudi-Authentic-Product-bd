import { RefundModel, type IRefund } from "../models/Refund.model";
import { OrderModel } from "../models/Order.model";
import { ApiError } from "../utils/ApiError";
import * as orderService from "./order.service";
import { getApprovalSettings } from "./approvalSettings.service";
import { createPendingAction, registerPendingActionHandler } from "./pendingAction.service";
import { createConfirmedExpense } from "./expense.service";
import { markPaymentRefundedForOrder } from "./payment.service";
import { recordAuditLog } from "./auditLog.service";
import type { CreateRefundInput } from "../validators/refund.validator";
import type { Role } from "../constants/roles";

export interface RefundActor {
  id: string;
  role: Role;
}

export type CreateRefundResult = { kind: "created"; refund: IRefund } | { kind: "pending"; pendingActionId: string };

async function insertRefundRequest(input: CreateRefundInput, requester: RefundActor): Promise<IRefund> {
  const order = await OrderModel.findById(input.orderId);
  if (!order) throw ApiError.notFound("Order not found");
  if (order.status !== "returned") {
    throw ApiError.badRequest('A refund can only be requested once the order is marked "returned"');
  }

  const customerId = requester.role === "customer" ? requester.id : order.customer.toString();
  if (requester.role === "customer" && order.customer.toString() !== requester.id) {
    throw ApiError.forbidden("You can only request a refund on your own order");
  }

  const refund = await RefundModel.create({
    order: order._id,
    customer: customerId,
    reasonCategory: input.reasonCategory,
    requestedAmountBDT: input.requestedAmountBDT,
    note: input.note,
    status: "pending_review",
    requestedBy: requester.id,
    requestedByRole: requester.role,
  });

  await recordAuditLog({
    actor: requester.id,
    actorRole: requester.role,
    action: "refund.request",
    resource: "Refund",
    resourceId: refund._id.toString(),
    newValue: input,
  });

  return refund;
}

/**
 * Per ROLES_AND_PERMISSIONS_v2.md §19, a `co_admin`'s refund request always
 * requires a Super Admin grant before the `Refund` document even exists —
 * everyone else (customer, order_manager, admin, super_admin) creates the
 * request directly, entering the normal review pipeline below.
 */
export async function createRefundRequest(
  input: CreateRefundInput,
  requester: RefundActor
): Promise<CreateRefundResult> {
  if (requester.role === "co_admin") {
    const action = await createPendingAction(
      "refund.request",
      { ...input, requestedById: requester.id, requestedByRole: requester.role },
      requester
    );
    return { kind: "pending", pendingActionId: action._id.toString() };
  }

  const refund = await insertRefundRequest(input, requester);
  return { kind: "created", refund };
}

export async function listRefunds(
  filter: { status?: string; page: number; limit: number },
  viewer: RefundActor
) {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (viewer.role === "co_admin") query.requestedBy = viewer.id;
  if (viewer.role === "customer") query.customer = viewer.id;

  const skip = (filter.page - 1) * filter.limit;
  const [refunds, total] = await Promise.all([
    RefundModel.find(query)
      .populate("order", "orderNumber totalBDT")
      .populate("customer", "name email")
      .populate("requestedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filter.limit),
    RefundModel.countDocuments(query),
  ]);

  return {
    refunds,
    pagination: {
      page: filter.page,
      limit: filter.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filter.limit)),
    },
  };
}

/** Order Manager (or Admin/Super Admin) reviews a freshly-submitted request. */
export async function reviewRefund(
  id: string,
  reviewer: RefundActor,
  decision: "approve" | "reject",
  reviewNote?: string
): Promise<IRefund> {
  const refund = await RefundModel.findById(id);
  if (!refund) throw ApiError.notFound("Refund request not found");
  if (refund.status !== "pending_review") {
    throw ApiError.badRequest(`This request is already ${refund.status}`);
  }

  refund.reviewedBy = reviewer.id as unknown as IRefund["reviewedBy"];
  refund.reviewedAt = new Date();
  refund.reviewNote = reviewNote;
  refund.status = decision === "approve" ? "pending_approval" : "rejected";
  await refund.save();

  await recordAuditLog({
    actor: reviewer.id,
    actorRole: reviewer.role,
    action: "refund.review",
    resource: "Refund",
    resourceId: refund._id.toString(),
    newValue: { status: refund.status },
    note: reviewNote,
  });

  return refund;
}

/** Rejection is also allowed at the financial-approval stage (not just at review). */
export async function rejectRefund(id: string, reviewer: RefundActor, reviewNote?: string): Promise<IRefund> {
  const refund = await RefundModel.findById(id);
  if (!refund) throw ApiError.notFound("Refund request not found");
  if (refund.status !== "pending_review" && refund.status !== "pending_approval") {
    throw ApiError.badRequest(`This request is already ${refund.status}`);
  }

  refund.status = "rejected";
  refund.reviewedBy = reviewer.id as unknown as IRefund["reviewedBy"];
  refund.reviewedAt = new Date();
  refund.reviewNote = reviewNote;
  await refund.save();

  await recordAuditLog({
    actor: reviewer.id,
    actorRole: reviewer.role,
    action: "refund.reject",
    resource: "Refund",
    resourceId: refund._id.toString(),
    newValue: { status: "rejected" },
    note: reviewNote,
  });

  return refund;
}

async function finalizeRefundApproval(refund: IRefund, approver: RefundActor): Promise<IRefund> {
  await orderService.updateOrderStatus(
    refund.order.toString(),
    "refunded",
    { id: approver.id, role: approver.role },
    `Refund approved (${refund._id.toString()})`
  );

  // Closes the gateway payment's own lifecycle (paid -> refunded). A no-op for
  // a cash-on-delivery order, which has no gateway payment record.
  await markPaymentRefundedForOrder(refund.order.toString(), approver);

  const expense = await createConfirmedExpense({
    category: "refund",
    amountBDT: refund.requestedAmountBDT,
    note: `Refund for order ${refund.order.toString()}`,
    linkedRefund: refund._id.toString(),
    actor: approver,
  });

  refund.status = "approved";
  refund.approvedBy = approver.id as unknown as IRefund["approvedBy"];
  refund.approvedAt = new Date();
  refund.linkedExpense = expense._id;
  await refund.save();

  await recordAuditLog({
    actor: approver.id,
    actorRole: approver.role,
    action: "refund.approve",
    resource: "Refund",
    resourceId: refund._id.toString(),
    newValue: { status: "approved" },
  });

  return refund;
}

export type ApproveRefundResult = { kind: "approved"; refund: IRefund } | { kind: "pending"; pendingActionId: string };

/**
 * `super_admin` always approves directly, any amount. `admin` approves
 * directly only at/below the Super-Admin-editable threshold; above it, the
 * attempt is routed through the approval gate instead of applying.
 */
export async function approveRefund(id: string, approver: RefundActor): Promise<ApproveRefundResult> {
  const refund = await RefundModel.findById(id);
  if (!refund) throw ApiError.notFound("Refund request not found");
  if (refund.status !== "pending_approval") {
    throw ApiError.badRequest('This request must be reviewed and marked "pending approval" first');
  }

  if (approver.role === "admin") {
    const settings = await getApprovalSettings();
    if (refund.requestedAmountBDT > settings.refundAutoApproveThresholdBDT) {
      const action = await createPendingAction("refund.approve", { refundId: id }, approver);
      return { kind: "pending", pendingActionId: action._id.toString() };
    }
  }

  const approved = await finalizeRefundApproval(refund, approver);
  return { kind: "approved", refund: approved };
}

// -- Approval-gate handlers --
registerPendingActionHandler("refund.request", async (payload) => {
  const { requestedById, requestedByRole, ...input } = payload as CreateRefundInput & {
    requestedById: string;
    requestedByRole: Role;
  };
  const refund = await insertRefundRequest(input, { id: requestedById, role: requestedByRole });
  return { resource: "Refund", resourceId: refund._id.toString() };
});

registerPendingActionHandler("refund.approve", async (payload, reviewer) => {
  const refund = await RefundModel.findById(payload.refundId as string);
  if (!refund) throw ApiError.notFound("Refund request not found");
  const approved = await finalizeRefundApproval(refund, reviewer);
  return { resource: "Refund", resourceId: approved._id.toString() };
});

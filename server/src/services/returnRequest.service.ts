import { ReturnRequestModel, type IReturnRequest } from "../models/ReturnRequest.model";
import { OrderModel } from "../models/Order.model";
import { ApiError } from "../utils/ApiError";
import * as orderService from "./order.service";
import { recordAuditLog } from "./auditLog.service";
import type { CreateReturnRequestInput } from "../validators/returnRequest.validator";
import type { Role } from "../constants/roles";

export interface ReturnRequestActor {
  id: string;
  role: Role;
}

/**
 * The customer-facing entry point into the return/exchange pipeline — the
 * piece that was missing before (only staff could move an order to
 * `"returned"`, and only after the fact). Only allowed once an order has
 * actually been delivered, and only one open (pending) request per order at
 * a time, so a customer can't flood the queue with duplicates for the same
 * order.
 */
export async function createReturnRequest(
  input: CreateReturnRequestInput,
  requester: ReturnRequestActor
): Promise<IReturnRequest> {
  const order = await OrderModel.findById(input.orderId);
  if (!order) throw ApiError.notFound("Order not found");
  if (order.customer.toString() !== requester.id) {
    throw ApiError.forbidden("You can only request a return or exchange on your own order");
  }
  if (order.status !== "delivered") {
    throw ApiError.badRequest('A return or exchange can only be requested once the order is "delivered"');
  }

  const existingOpen = await ReturnRequestModel.findOne({ order: order._id, status: "pending" });
  if (existingOpen) {
    throw ApiError.conflict("There is already a pending return/exchange request for this order");
  }

  const request = await ReturnRequestModel.create({
    order: order._id,
    customer: requester.id,
    type: input.type,
    reasonCategory: input.reasonCategory,
    note: input.note,
    desiredExchangeDetails: input.type === "exchange" ? input.desiredExchangeDetails : undefined,
    status: "pending",
  });

  await recordAuditLog({
    actor: requester.id,
    actorRole: requester.role,
    action: "return.request",
    resource: "ReturnRequest",
    resourceId: request._id.toString(),
    newValue: { type: input.type, reasonCategory: input.reasonCategory },
  });

  return request;
}

/** Staff sees everything (optionally filtered by status); a customer is force-scoped to their own requests. */
export async function listReturnRequests(
  filter: { status?: string; page: number; limit: number },
  viewer: ReturnRequestActor
) {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (viewer.role === "customer") query.customer = viewer.id;

  const skip = (filter.page - 1) * filter.limit;
  const [requests, total] = await Promise.all([
    ReturnRequestModel.find(query)
      .populate("order", "orderNumber totalBDT status")
      .populate("customer", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filter.limit),
    ReturnRequestModel.countDocuments(query),
  ]);

  return {
    requests,
    pagination: {
      page: filter.page,
      limit: filter.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filter.limit)),
    },
  };
}

/**
 * `type: "return"` — approving transitions the underlying order to
 * `"returned"` (reusing the existing pipeline's own transition/actor-role
 * checks, exactly as `refund.service.ts` does for `returned -> refunded`),
 * which is what then lets the customer or staff file the existing `Refund`
 * request. `type: "exchange"` — approving only marks the request approved;
 * there is no automated replacement-order system in this codebase (see
 * CLAUDE.md), so fulfilling an approved exchange is a manual action a staff
 * member takes outside this endpoint (a new order, a manual stock
 * correction), not something this call performs itself.
 */
export async function reviewReturnRequest(
  id: string,
  reviewer: ReturnRequestActor,
  decision: "approve" | "reject",
  reviewNote?: string
): Promise<IReturnRequest> {
  const request = await ReturnRequestModel.findById(id);
  if (!request) throw ApiError.notFound("Return/exchange request not found");
  if (request.status !== "pending") {
    throw ApiError.badRequest(`This request is already ${request.status}`);
  }

  if (decision === "approve" && request.type === "return") {
    await orderService.updateOrderStatus(
      request.order.toString(),
      "returned",
      { id: reviewer.id, role: reviewer.role },
      `Return request approved (${request._id.toString()})`
    );
  }

  request.status = decision === "approve" ? "approved" : "rejected";
  request.reviewedBy = reviewer.id as unknown as IReturnRequest["reviewedBy"];
  request.reviewedAt = new Date();
  request.reviewNote = reviewNote;
  await request.save();

  await recordAuditLog({
    actor: reviewer.id,
    actorRole: reviewer.role,
    action: decision === "approve" ? "return.approve" : "return.reject",
    resource: "ReturnRequest",
    resourceId: request._id.toString(),
    newValue: { status: request.status },
    note: reviewNote,
  });

  return request;
}

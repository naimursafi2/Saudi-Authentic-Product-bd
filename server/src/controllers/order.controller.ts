import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { paramStr } from "../utils/params";
import * as orderService from "../services/order.service";
import { ADMIN_PORTAL_ROLES } from "../constants/roles";
import type { OrderStatus } from "../models/Order.model";

/** Only surface the OTP to the order's owner, and only while it's actionable
 * (`out_for_delivery`) — never to staff/agents, who must obtain it verbally
 * from the customer. */
function ownerVisibleOtp(order: { status: OrderStatus; otpCode?: string }, isOwner: boolean): string | undefined {
  return isOwner && order.status === "out_for_delivery" ? order.otpCode : undefined;
}

export const createOrder = catchAsync(async (req: Request, res: Response) => {
  const order = await orderService.createOrder(req.user!.id, req.body);
  sendSuccess(res, 201, "Order placed successfully", { order });
});

export const listMyOrders = catchAsync(async (req: Request, res: Response) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const { orders, pagination } = await orderService.listMyOrders(req.user!.id, page, limit);
  sendSuccess(res, 200, "Orders fetched", { orders }, { pagination });
});

export const listOrders = catchAsync(async (req: Request, res: Response) => {
  const { status, page, limit } = req.query as unknown as {
    status?: OrderStatus;
    page: number;
    limit: number;
  };
  const { orders, pagination } = await orderService.listOrders({ status, page, limit });
  sendSuccess(res, 200, "Orders fetched", { orders }, { pagination });
});

export const trackOrder = catchAsync(async (req: Request, res: Response) => {
  const { orderNumber, email } = req.query as unknown as { orderNumber: string; email: string };
  const order = await orderService.trackOrder(orderNumber, email);
  // trackOrder is inherently owner-scoped — it requires the checkout email to match.
  sendSuccess(res, 200, "Order found", { order, otp: ownerVisibleOtp(order, true) });
});

export const getOrder = catchAsync(async (req: Request, res: Response) => {
  const order = await orderService.getOrderById(paramStr(req.params.id));

  // `customer` is populated with { _id, name, email } here, but typed as a
  // plain ObjectId on the schema — normalize before comparing.
  const populatedCustomer = order.customer as unknown as { _id?: { toString(): string } };
  const customerId = populatedCustomer._id?.toString() ?? order.customer.toString();

  const isOwner = customerId === req.user!.id;
  const isStaff = ADMIN_PORTAL_ROLES.includes(req.user!.role) || req.user!.role === "employee";
  const isAssignedAgent =
    req.user!.role === "delivery_agent" && order.assignedAgent?.toString() === req.user!.id;
  if (!isOwner && !isStaff && !isAssignedAgent) {
    throw ApiError.forbidden("You do not have permission to view this order");
  }

  sendSuccess(res, 200, "Order fetched", { order, otp: ownerVisibleOtp(order, isOwner) });
});

export const updateOrderStatus = catchAsync(async (req: Request, res: Response) => {
  const order = await orderService.updateOrderStatus(
    paramStr(req.params.id),
    req.body.status,
    { id: req.user!.id, role: req.user!.role },
    req.body.note
  );
  sendSuccess(res, 200, "Order status updated", { order });
});

export const listAssignedOrders = catchAsync(async (req: Request, res: Response) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const { orders, pagination } = await orderService.listAssignedOrders(req.user!.id, page, limit);
  sendSuccess(res, 200, "Assigned orders fetched", { orders }, { pagination });
});

export const assignDeliveryAgent = catchAsync(async (req: Request, res: Response) => {
  const order = await orderService.assignDeliveryAgent(paramStr(req.params.id), req.body.agentId, {
    id: req.user!.id,
    role: req.user!.role,
  });
  sendSuccess(res, 200, "Delivery agent assigned", { order });
});

export const updateDeliveryStatus = catchAsync(async (req: Request, res: Response) => {
  const order = await orderService.updateDeliveryStatus(
    paramStr(req.params.id),
    req.user!.id,
    req.body.status,
    req.body.note
  );
  sendSuccess(res, 200, "Delivery status updated", { order });
});

export const sendDeliveryOtp = catchAsync(async (req: Request, res: Response) => {
  const order = await orderService.sendDeliveryOtp(paramStr(req.params.id), req.user!.id);
  sendSuccess(res, 200, "Delivery OTP sent to the customer", { order });
});

export const verifyDeliveryOtp = catchAsync(async (req: Request, res: Response) => {
  const order = await orderService.verifyDeliveryOtp(paramStr(req.params.id), req.user!.id, req.body.otp, req.body.note);
  sendSuccess(res, 200, "Delivery confirmed", { order });
});

export const markDeliveryFailed = catchAsync(async (req: Request, res: Response) => {
  const order = await orderService.markDeliveryFailed(
    paramStr(req.params.id),
    req.user!.id,
    req.body.failureReason,
    req.body.note
  );
  sendSuccess(res, 200, "Delivery marked as failed", { order });
});

import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { paramStr } from "../utils/params";
import * as orderService from "../services/order.service";
import * as paymentService from "../services/payment.service";
import { isSslcommerzConfigured } from "../config/sslcommerz";
import { ADMIN_PORTAL_ROLES } from "../constants/roles";
import type { OrderStatus } from "../models/Order.model";

type OrderDoc = Awaited<ReturnType<typeof orderService.getOrderById>>;

/**
 * Builds the `{ order, otp }` payload. The live delivery OTP lives in Redis
 * (not on the order), so its timing is merged back in as `otpGeneratedAt` /
 * `otpExpiresAt` — the delivery UI uses those to decide between "Send OTP"
 * and the code-entry form. The code itself is only surfaced to the order's
 * owner, and only while it's actionable (`out_for_delivery`) — never to
 * staff/agents, who must obtain it verbally from the customer.
 */
async function withDeliveryOtp(order: OrderDoc, isOwner: boolean) {
  const stored = await orderService.getDeliveryOtpView(order._id.toString(), order.status);
  return {
    order: {
      ...order.toJSON(),
      otpGeneratedAt: stored?.generatedAt,
      otpExpiresAt: stored?.expiresAt,
    },
    otp: isOwner && stored ? stored.code : undefined,
  };
}

export const createOrder = catchAsync(async (req: Request, res: Response) => {
  const order = await orderService.createOrder(req.user!.id, req.body);

  // For online payment, open the SSLCommerz session in this same request so
  // the browser can jump straight to the gateway — one round trip instead of
  // "create order" then "start payment". If the gateway call fails the order
  // still exists; the client falls back to POST /payments/sslcommerz/init.
  let payment: { gatewayUrl?: string } | undefined;
  if (order.paymentMethod === "sslcommerz" && isSslcommerzConfigured) {
    try {
      const created = await paymentService.initSslcommerzPaymentForOrder(order._id.toString(), {
        id: req.user!.id,
        role: req.user!.role,
      });
      const gatewayUrl = created.gatewayMetadata?.gatewayUrl;
      if (typeof gatewayUrl === "string") payment = { gatewayUrl };
    } catch (err) {
      console.error("[orders] SSLCommerz session could not be opened at checkout:", (err as Error).message);
    }
  }

  sendSuccess(res, 201, "Order placed successfully", { order, payment });
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
  sendSuccess(res, 200, "Order found", await withDeliveryOtp(order, true));
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

  sendSuccess(res, 200, "Order fetched", await withDeliveryOtp(order, isOwner));
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
  const { status, page, limit } = req.query as unknown as { status?: string; page: number; limit: number };
  const { orders, pagination } = await orderService.listAssignedOrders(req.user!.id, page, limit, status);
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
  sendSuccess(res, 200, "Delivery OTP sent to the customer", await withDeliveryOtp(order, false));
});

export const verifyDeliveryOtp = catchAsync(async (req: Request, res: Response) => {
  const order = await orderService.verifyDeliveryOtp(
    paramStr(req.params.id),
    req.user!.id,
    req.body.otp,
    req.body.note,
    req.file
  );
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

import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { paramStr } from "../utils/params";
import * as paymentService from "../services/payment.service";
import { OrderModel } from "../models/Order.model";
import { isBkashConfigured } from "../config/bkash";
import type { ListPaymentsQuery } from "../validators/payment.validator";

/** Booleans only — the storefront needs to know which providers are live, never how they are configured. */
export const getPaymentConfig = catchAsync(async (_req: Request, res: Response) => {
  sendSuccess(res, 200, "Payment configuration fetched", {
    providers: { bkash: isBkashConfigured },
  });
});

export const createBkashPayment = catchAsync(async (req: Request, res: Response) => {
  const payment = await paymentService.createBkashPaymentForOrder(req.body.orderId, {
    id: req.user!.id,
    role: req.user!.role,
  });

  // Only what the customer's browser genuinely needs to continue. The gateway
  // payment id and checkout URL are the whole safe surface — credentials, the
  // grant token and the raw gateway response never leave the server.
  sendSuccess(res, 201, "bKash payment created", {
    payment: {
      id: payment._id.toString(),
      gatewayPaymentId: payment.gatewayPaymentId,
      bkashURL: payment.gatewayMetadata?.bkashURL,
      amountBDT: payment.amountBDT,
      currency: payment.currency,
      status: payment.status,
    },
  });
});

export const executeBkashPayment = catchAsync(async (req: Request, res: Response) => {
  const { payment, order } = await paymentService.executeBkashPaymentForOrder(req.body.paymentID, {
    id: req.user!.id,
    role: req.user!.role,
  });
  sendSuccess(res, 200, "Payment successful", { payment, order });
});

export const cancelBkashPayment = catchAsync(async (req: Request, res: Response) => {
  const payment = await paymentService.cancelBkashPaymentForOrder(
    req.body.paymentID,
    { id: req.user!.id, role: req.user!.role },
    req.body.reason
  );
  sendSuccess(res, 200, "Payment cancelled", { payment });
});

export const listPayments = catchAsync(async (req: Request, res: Response) => {
  const filter = req.query as unknown as ListPaymentsQuery;
  const { payments, pagination } = await paymentService.listPayments(filter);
  sendSuccess(res, 200, "Payments fetched", { payments }, { pagination });
});

/** The order's payment, for the customer's own order page or for staff. */
export const getPaymentForOrder = catchAsync(async (req: Request, res: Response) => {
  const orderId = paramStr(req.params.orderId);
  const order = await OrderModel.findById(orderId).select("customer");
  if (!order) throw ApiError.notFound("Order not found");

  const isOwner = order.customer.toString() === req.user!.id;
  const canViewAny = (req.user!.permissions ?? []).includes("payments.view");
  if (!isOwner && !canViewAny) {
    throw ApiError.forbidden("You do not have permission to view this payment");
  }

  const payment = await paymentService.getPaymentForOrder(orderId);
  sendSuccess(res, 200, "Payment fetched", { payment });
});

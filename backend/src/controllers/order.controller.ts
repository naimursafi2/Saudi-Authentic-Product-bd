import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { paramStr } from "../utils/params";
import * as orderService from "../services/order.service";
import { ADMIN_PORTAL_ROLES } from "../constants/roles";
import type { OrderStatus } from "../models/Order.model";

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

export const getOrder = catchAsync(async (req: Request, res: Response) => {
  const order = await orderService.getOrderById(paramStr(req.params.id));

  // `customer` is populated with { _id, name, email } here, but typed as a
  // plain ObjectId on the schema — normalize before comparing.
  const populatedCustomer = order.customer as unknown as { _id?: { toString(): string } };
  const customerId = populatedCustomer._id?.toString() ?? order.customer.toString();

  const isOwner = customerId === req.user!.id;
  const isStaff = ADMIN_PORTAL_ROLES.includes(req.user!.role) || req.user!.role === "employee";
  if (!isOwner && !isStaff) {
    throw ApiError.forbidden("You do not have permission to view this order");
  }

  sendSuccess(res, 200, "Order fetched", { order });
});

export const updateOrderStatus = catchAsync(async (req: Request, res: Response) => {
  const order = await orderService.updateOrderStatus(paramStr(req.params.id), req.body.status, req.body.note);
  sendSuccess(res, 200, "Order status updated", { order });
});

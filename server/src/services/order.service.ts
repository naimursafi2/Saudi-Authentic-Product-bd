import { Types } from "mongoose";
import { ProductModel } from "../models/Product.model";
import { UserModel } from "../models/User.model";
import { OrderModel, type IOrder } from "../models/Order.model";
import type { InventoryLogReason } from "../models/InventoryLog.model";
import { ApiError } from "../utils/ApiError";
import { computeShippingFee } from "../constants/shipping";
import { recordStockChange } from "./inventory.service";
import { sendOrderConfirmationEmail, sendDeliveryOtpEmail } from "./email.service";
import { sendSms } from "../config/sms";
import { notifyNewOrder, notifyLowStock, notifyDeliveryFailed } from "./notification.service";
import { applyCouponUsage, validateCouponForOrder } from "./coupon.service";
import { DELIVERY_ONLY_STATUSES, GENERIC_STATUS_ACTOR_ROLES, ORDER_TRANSITIONS, type OrderStatus } from "../constants/orderStatus";
import { DELIVERY_OTP_TTL_MINUTES, MAX_DELIVERY_OTP_ATTEMPTS } from "../constants/security";
import type { Role } from "../constants/roles";
import type { CreateOrderInput } from "../validators/order.validator";

export interface OrderActor {
  id: string;
  role: Role;
}

async function generateOrderNumber(): Promise<string> {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const random = Math.floor(1000 + Math.random() * 9000);
    const candidate = `SAP-${datePart}-${random}`;

    const existing = await OrderModel.findOne({ orderNumber: candidate });
    if (!existing) return candidate;
  }
  throw ApiError.internal("Could not generate a unique order number, please try again");
}

function generateOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** Pushes a history entry, capturing the order's *current* status as `previousStatus`
 * — call this before mutating `order.status` to the new value. */
function pushStatusHistory(order: IOrder, status: OrderStatus, actor: OrderActor, note?: string) {
  order.statusHistory.push({
    status,
    previousStatus: order.status,
    at: new Date(),
    note,
    changedBy: new Types.ObjectId(actor.id),
    changedByRole: actor.role,
  });
}

/** Restocks every item on an order and writes an inventory audit-trail entry per variant. */
async function restockOrderItems(order: IOrder, reason: InventoryLogReason) {
  await Promise.all(
    order.items.map(async (item) => {
      const updated = await ProductModel.findOneAndUpdate(
        { _id: item.product, "variants._id": item.variantId },
        { $inc: { "variants.$.stock": item.quantity } },
        { new: true }
      );
      const variant = updated?.variants.find((v) => v._id?.toString() === item.variantId);
      await recordStockChange({
        productId: item.product.toString(),
        variantId: item.variantId,
        variantLabel: item.variantLabel,
        delta: item.quantity,
        balanceAfter: variant?.stock ?? 0,
        reason,
        note: `Order ${order.orderNumber} ${reason === "order_cancelled" ? "cancelled" : "returned"}`,
      });
    })
  );
}

export async function createOrder(customerId: string, input: CreateOrderInput) {
  // Re-price every line item from the database — the client's cart is never trusted.
  const items: IOrder["items"] = [];
  let subtotalBDT = 0;

  for (const line of input.items) {

    const product = await ProductModel.findById(line.productId);
    if (!product || !product.isActive) {
      throw ApiError.badRequest(`Product ${line.productId} is no longer available`);
    }
    const variant = product.variants.find((v) => v._id?.toString() === line.variantId);
    if (!variant) {
      throw ApiError.badRequest(`Selected variant is no longer available for ${product.name}`);
    }
    if (variant.stock < line.quantity) {
      throw ApiError.badRequest(`Not enough stock for ${product.name} (${variant.label})`);
    }

    const lineTotal = variant.priceBDT * line.quantity;
    subtotalBDT += lineTotal;

    items.push({
      product: product._id,
      productName: product.name,
      variantId: variant._id!.toString(),
      variantLabel: variant.label,
      unitPriceBDT: variant.priceBDT,
      quantity: line.quantity,
      lineTotalBDT: lineTotal,
    });
  }

  const shippingFeeBDT = computeShippingFee(input.deliveryMethod, subtotalBDT);

  // Re-validated from scratch here regardless of any earlier
  // `/coupons/validate` preview — a client-submitted discount amount is
  // never trusted, only the coupon *code*.
  let discountBDT = 0;
  let appliedCoupon: Awaited<ReturnType<typeof validateCouponForOrder>>["coupon"] | undefined;
  if (input.couponCode) {
    const result = await validateCouponForOrder(input.couponCode, subtotalBDT);
    discountBDT = result.discountBDT;
    appliedCoupon = result.coupon;
  }

  const totalBDT = Math.max(0, subtotalBDT + shippingFeeBDT - discountBDT);
  const orderNumber = await generateOrderNumber();

  const order = await OrderModel.create({
    orderNumber,
    customer: customerId,
    items,
    shippingAddress: input.shippingAddress,
    deliveryMethod: input.deliveryMethod,
    shippingFeeBDT,
    paymentMethod: input.paymentMethod,
    subtotalBDT,
    couponCode: appliedCoupon?.code,
    discountBDT,
    totalBDT,
    status: "pending",
    statusHistory: [{ status: "pending", at: new Date(), changedBy: customerId, changedByRole: "customer" }],
  });

  if (appliedCoupon) {
    await applyCouponUsage(appliedCoupon._id.toString(), appliedCoupon.usageLimit);
  }

  // Decrement stock for each purchased variant and record an audit trail entry.
  await Promise.all(
    items.map(async (item) => {
      const updated = await ProductModel.findOneAndUpdate(
        { _id: item.product, "variants._id": item.variantId },
        { $inc: { "variants.$.stock": -item.quantity } },
        { new: true }
      );
      const variant = updated?.variants.find((v) => v._id?.toString() === item.variantId);
      await recordStockChange({
        productId: item.product.toString(),
        variantId: item.variantId,
        variantLabel: item.variantLabel,
        delta: -item.quantity,
        balanceAfter: variant?.stock ?? 0,
        reason: "order_placed",
        note: `Order ${orderNumber}`,
      });

      // Alert only on the crossing, not on every further sale below the line,
      // so a persistently low variant doesn't email staff on every order.
      if (updated && variant) {
        const before = variant.stock + item.quantity;
        if (before > variant.lowStockThreshold && variant.stock <= variant.lowStockThreshold) {
          void notifyLowStock({
            productName: updated.name,
            variantLabel: variant.label,
            stock: variant.stock,
            threshold: variant.lowStockThreshold,
          });
        }
      }
    })
  );

  // Fire-and-forget — sendOrderConfirmationEmail already swallows its own
  // errors, and a real SMTP round-trip is too slow to make the customer
  // wait on before confirming their order.
  const customerName = `${input.shippingAddress.firstName} ${input.shippingAddress.lastName}`;
  void sendOrderConfirmationEmail(input.shippingAddress.email, customerName, { orderNumber, totalBDT });
  void notifyNewOrder({ orderNumber, totalBDT, customerName, itemCount: items.length });

  return order;
}

export async function getOrderById(id: string) {
  const order = await OrderModel.findById(id).select("+otpCode").populate("customer", "name email");
  if (!order) throw ApiError.notFound("Order not found");
  return order;
}

/**
 * Public order-tracking lookup — no auth. Requires both the order number and
 * the email used at checkout so a guessed/leaked order number alone can't be
 * used to pull up someone else's order details.
 */
export async function trackOrder(orderNumber: string, email: string) {
  const order = await OrderModel.findOne({
    orderNumber: orderNumber.trim().toUpperCase(),
    "shippingAddress.email": email.trim().toLowerCase(),
  }).select("+otpCode");
  if (!order) {
    throw ApiError.notFound("No order found for that Order ID and email. Please check and try again.");
  }
  return order;
}

export async function listMyOrders(customerId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const filter = { customer: customerId };
  const [orders, total] = await Promise.all([
    OrderModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    OrderModel.countDocuments(filter),
  ]);
  return {
    orders,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function listOrders(filter: { status?: OrderStatus; page: number; limit: number }) {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;

  const skip = (filter.page - 1) * filter.limit;
  const [orders, total] = await Promise.all([
    OrderModel.find(query)
      .populate("customer", "name email")
      .populate("assignedAgent", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filter.limit),
    OrderModel.countDocuments(query),
  ]);

  return {
    orders,
    pagination: {
      page: filter.page,
      limit: filter.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filter.limit)),
    },
  };
}

export async function listAssignedOrders(agentId: string, page: number, limit: number) {
  const filter = { assignedAgent: agentId };
  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    OrderModel.find(filter)
      .populate("customer", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    OrderModel.countDocuments(filter),
  ]);
  return {
    orders,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/** Generic status-transition endpoint — covers every hop except the
 * delivery-agent-only statuses in `DELIVERY_ONLY_STATUSES`, which must go
 * through their own dedicated functions below. */
export async function updateOrderStatus(id: string, status: OrderStatus, actor: OrderActor, note?: string) {
  const order = await OrderModel.findById(id);
  if (!order) throw ApiError.notFound("Order not found");

  if (DELIVERY_ONLY_STATUSES.includes(status)) {
    throw ApiError.badRequest(`Status "${status}" can only be set through its dedicated delivery endpoint`);
  }

  const allowedNext = ORDER_TRANSITIONS[order.status];
  if (!allowedNext || allowedNext.length === 0) {
    throw ApiError.badRequest(`Order is already ${order.status} and cannot be updated`);
  }
  if (!allowedNext.includes(status)) {
    throw ApiError.badRequest(`Invalid status transition from ${order.status} to ${status}`);
  }

  const isOverride = actor.role === "admin" || actor.role === "super_admin";
  if (!isOverride) {
    const allowedActors = GENERIC_STATUS_ACTOR_ROLES[order.status] ?? [];
    if (!allowedActors.includes(actor.role)) {
      throw ApiError.forbidden("You are not permitted to change this order's status");
    }
  }

  if (status === "cancelled") {
    await restockOrderItems(order, "order_cancelled");
  } else if (status === "returned") {
    await restockOrderItems(order, "order_returned");
  }

  pushStatusHistory(order, status, actor, note);
  order.status = status;
  await order.save();
  return order;
}

export async function assignDeliveryAgent(orderId: string, agentId: string, actor: OrderActor) {
  const order = await OrderModel.findById(orderId);
  if (!order) throw ApiError.notFound("Order not found");
  if (order.status !== "ready_for_dispatch" && order.status !== "delivery_failed") {
    throw ApiError.badRequest(`Cannot assign a delivery agent while the order is "${order.status}"`);
  }

  const agent = await UserModel.findById(agentId);
  if (!agent || agent.role !== "delivery_agent") {
    throw ApiError.badRequest("Selected user is not a delivery agent");
  }
  if (!agent.isActive) {
    throw ApiError.badRequest("Selected delivery agent is not active");
  }

  order.assignedAgent = agent._id;
  pushStatusHistory(order, "assigned_to_agent", actor);
  order.status = "assigned_to_agent";
  await order.save();
  return order;
}

async function loadOrderAssignedTo(orderId: string, agentId: string) {
  const order = await OrderModel.findById(orderId).select("+otpCode");
  if (!order) throw ApiError.notFound("Order not found");
  if (!order.assignedAgent || order.assignedAgent.toString() !== agentId) {
    throw ApiError.forbidden("This order is not assigned to you");
  }
  return order;
}

export async function updateDeliveryStatus(
  orderId: string,
  agentId: string,
  status: "picked_up" | "out_for_delivery",
  note?: string
) {
  const order = await loadOrderAssignedTo(orderId, agentId);
  const actor: OrderActor = { id: agentId, role: "delivery_agent" };

  if (status === "picked_up") {
    if (order.status !== "assigned_to_agent") {
      throw ApiError.badRequest(`Cannot mark picked up from "${order.status}"`);
    }
    pushStatusHistory(order, "picked_up", actor, note);
    order.status = "picked_up";
    await order.save();
    return order;
  }

  // out_for_delivery is a pure dispatch signal — it no longer generates or
  // sends an OTP itself. The agent sends that separately, once they've
  // actually reached the customer (see `sendDeliveryOtp` below), not the
  // moment they leave for the delivery run.
  if (order.status !== "picked_up") {
    throw ApiError.badRequest(`Cannot mark out for delivery from "${order.status}"`);
  }
  pushStatusHistory(order, "out_for_delivery", actor, note);
  order.status = "out_for_delivery";
  await order.save();
  return order;
}

/**
 * "Send Delivery OTP" — generates a fresh code and dispatches it to the
 * customer (email always; SMS too once a gateway is configured, see
 * `config/sms.ts`). Callable more than once while `out_for_delivery` (the
 * delivery UI's "Resend OTP"), each call fully replacing the previous code
 * and resetting the attempt counter, so a resent code can't be brute-forced
 * using attempts spent against the old one.
 */
export async function sendDeliveryOtp(orderId: string, agentId: string) {
  const order = await loadOrderAssignedTo(orderId, agentId);
  if (order.status !== "out_for_delivery") {
    throw ApiError.badRequest(`Cannot send a delivery OTP from "${order.status}"`);
  }

  const otp = generateOtp();
  order.otpCode = otp;
  order.otpGeneratedAt = new Date();
  order.otpExpiresAt = new Date(Date.now() + DELIVERY_OTP_TTL_MINUTES * 60 * 1000);
  order.otpAttempts = 0;
  await order.save();

  const customerName = `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`;
  void sendDeliveryOtpEmail(order.shippingAddress.email, customerName, {
    orderNumber: order.orderNumber,
    otp,
  });
  void sendSms(
    order.shippingAddress.phone,
    `Saudi Authentic Product\nHello ${customerName}, your delivery verification OTP is ${otp}.\n` +
      "Please share this OTP with the delivery person only after receiving your product.\n" +
      `This OTP will expire in ${DELIVERY_OTP_TTL_MINUTES} minutes.`
  );

  return order;
}

export async function verifyDeliveryOtp(orderId: string, agentId: string, otp: string, note?: string) {
  const order = await loadOrderAssignedTo(orderId, agentId);
  const actor: OrderActor = { id: agentId, role: "delivery_agent" };

  if (order.status !== "out_for_delivery") {
    throw ApiError.badRequest(`Cannot verify OTP from "${order.status}"`);
  }
  if (!order.otpCode || !order.otpExpiresAt || order.otpExpiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest("OTP expired or not yet sent — send a new delivery OTP.");
  }

  if (otp.trim() !== order.otpCode) {
    order.otpAttempts += 1;
    if (order.otpAttempts >= MAX_DELIVERY_OTP_ATTEMPTS) {
      order.otpCode = undefined;
      order.otpGeneratedAt = undefined;
      order.otpExpiresAt = undefined;
      order.otpAttempts = 0;
      await order.save();
      throw ApiError.badRequest(
        "Too many incorrect attempts — this OTP has been invalidated. Send a new one."
      );
    }
    await order.save();
    throw ApiError.badRequest(
      `Incorrect OTP (${MAX_DELIVERY_OTP_ATTEMPTS - order.otpAttempts} attempt(s) remaining before it's invalidated)`
    );
  }

  pushStatusHistory(order, "otp_verified", actor, note);
  order.status = "otp_verified";
  order.otpVerifiedAt = new Date();

  pushStatusHistory(order, "delivered", actor, note);
  order.status = "delivered";
  if (order.paymentMethod === "cod") order.isPaid = true;

  // The only place these three fields are ever set — durable, directly
  // queryable proof that this delivery went through real OTP verification.
  order.deliveryVerified = true;
  order.deliveredAt = new Date();
  order.deliveredBy = new Types.ObjectId(agentId);

  order.otpCode = undefined;
  order.otpGeneratedAt = undefined;
  order.otpExpiresAt = undefined;
  order.otpAttempts = 0;

  await order.save();
  return order;
}

export async function markDeliveryFailed(orderId: string, agentId: string, failureReason: string, note?: string) {
  const order = await loadOrderAssignedTo(orderId, agentId);
  const actor: OrderActor = { id: agentId, role: "delivery_agent" };

  if (order.status !== "out_for_delivery") {
    throw ApiError.badRequest(`Cannot mark delivery failed from "${order.status}"`);
  }

  order.failureReason = failureReason;
  if (note) order.deliveryNotes = note;
  pushStatusHistory(order, "delivery_failed", actor, note);
  order.status = "delivery_failed";
  order.otpCode = undefined;
  order.otpGeneratedAt = undefined;
  order.otpExpiresAt = undefined;
  order.otpAttempts = 0;

  await order.save();

  const agent = await UserModel.findById(agentId).select("name");
  void notifyDeliveryFailed({
    orderNumber: order.orderNumber,
    agentName: agent?.name ?? "Unknown agent",
    failureReason,
  });

  return order;
}

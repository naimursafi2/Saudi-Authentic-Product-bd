import { ProductModel } from "../models/Product.model";
import { OrderModel, type IOrder, type OrderStatus } from "../models/Order.model";
import { ApiError } from "../utils/ApiError";
import { computeShippingFee } from "../constants/shipping";
import { recordStockChange } from "./inventory.service";
import { sendOrderConfirmationEmail } from "./email.service";
import type { CreateOrderInput } from "../validators/order.validator";

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
  const totalBDT = subtotalBDT + shippingFeeBDT;
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
    totalBDT,
    status: "pending",
    statusHistory: [{ status: "pending", at: new Date() }],
  });

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
    })
  );

  // Fire-and-forget — sendOrderConfirmationEmail already swallows its own
  // errors, and a real SMTP round-trip is too slow to make the customer
  // wait on before confirming their order.
  void sendOrderConfirmationEmail(
    input.shippingAddress.email,
    `${input.shippingAddress.firstName} ${input.shippingAddress.lastName}`,
    { orderNumber, totalBDT }
  );

  return order;
}

export async function getOrderById(id: string) {
  const order = await OrderModel.findById(id).populate("customer", "name email");
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
  });
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

export async function updateOrderStatus(id: string, status: OrderStatus, note?: string) {
  const order = await OrderModel.findById(id);
  if (!order) throw ApiError.notFound("Order not found");

  if (order.status === "delivered" || order.status === "cancelled") {
    throw ApiError.badRequest(`Order is already ${order.status} and cannot be updated`);
  }

  // Restock items if the order is being cancelled.
  if (status === "cancelled") {
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
          reason: "order_cancelled",
          note: `Order ${order.orderNumber} cancelled`,
        });
      })
    );
  }

  order.status = status;
  if (status === "delivered" && order.paymentMethod === "cod") {
    order.isPaid = true;
  }
  order.statusHistory.push({ status, at: new Date(), note });
  await order.save();
  return order;
}

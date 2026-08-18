import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { CategoryModel } from "../../models/Category.model";
import { ProductModel } from "../../models/Product.model";
import { OrderModel } from "../../models/Order.model";

const app = createApp();

const shippingAddress = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane.doe@example.com",
  phone: "+8801812345678",
  fullAddress: "House 1, Road 2",
  district: "Dhaka",
  cityArea: "Gulshan",
};

async function seedProduct() {
  const category = await CategoryModel.create({ name: "Dates", slug: "dates" });
  const product = await ProductModel.create({
    name: "Ajwa Dates",
    slug: "ajwa-dates",
    tagline: "Rich, soft Madinah dates",
    description: "Premium Ajwa dates.",
    origin: "Madinah",
    categories: [category._id],
    variants: [{ label: "500g", priceBDT: 1000, stock: 5, lowStockThreshold: 2 }],
  });
  return { category, product };
}

async function createTestOrder(customerToken: string, productId: string, variantId: string) {
  const res = await request(app)
    .post("/api/v1/orders")
    .set(...authHeader(customerToken))
    .send({
      items: [{ productId, variantId, quantity: 1 }],
      shippingAddress,
      deliveryMethod: "standard",
      paymentMethod: "cod",
    });
  return res.body.data.order as { _id: string; orderNumber: string; status: string };
}

describe("Order status pipeline, RBAC, and OTP flow", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("walks a full happy path from pending to delivered, recording actor/role at each hop", async () => {
    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    const { token: managerToken, user: manager } = await createAuthedUser({ role: "order_manager" });
    const { token: agentToken, user: agent } = await createAuthedUser({ role: "delivery_agent" });
    const { product } = await seedProduct();
    const variantId = product.variants[0]!._id!.toString();
    const order = await createTestOrder(customerToken, product._id.toString(), variantId);

    for (const status of ["confirmed", "processing", "packed", "ready_for_dispatch"]) {
      const res = await request(app)
        .patch(`/api/v1/orders/${order._id}/status`)
        .set(...authHeader(managerToken))
        .send({ status });
      expect(res.status).toBe(200);
      expect(res.body.data.order.status).toBe(status);
    }

    const assignRes = await request(app)
      .patch(`/api/v1/orders/${order._id}/assign-agent`)
      .set(...authHeader(managerToken))
      .send({ agentId: agent._id.toString() });
    expect(assignRes.status).toBe(200);
    expect(assignRes.body.data.order.status).toBe("assigned_to_agent");

    const pickedUpRes = await request(app)
      .patch(`/api/v1/orders/${order._id}/delivery-status`)
      .set(...authHeader(agentToken))
      .send({ status: "picked_up" });
    expect(pickedUpRes.status).toBe(200);

    const outForDeliveryRes = await request(app)
      .patch(`/api/v1/orders/${order._id}/delivery-status`)
      .set(...authHeader(agentToken))
      .send({ status: "out_for_delivery" });
    expect(outForDeliveryRes.status).toBe(200);

    const dbOrder = await OrderModel.findById(order._id).select("+otpCode");
    expect(dbOrder?.otpCode).toMatch(/^\d{6}$/);

    const wrongOtp = await request(app)
      .post(`/api/v1/orders/${order._id}/verify-otp`)
      .set(...authHeader(agentToken))
      .send({ otp: "000000" });
    expect(wrongOtp.status).toBe(400);

    const verifyRes = await request(app)
      .post(`/api/v1/orders/${order._id}/verify-otp`)
      .set(...authHeader(agentToken))
      .send({ otp: dbOrder!.otpCode });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.order.status).toBe("delivered");
    expect(verifyRes.body.data.order.isPaid).toBe(true);

    const finalOrder = await OrderModel.findById(order._id);
    expect(finalOrder?.otpCode).toBeUndefined();
    const history = finalOrder!.statusHistory;
    const deliveredEntry = history[history.length - 1];
    expect(deliveredEntry.status).toBe("delivered");
    expect(deliveredEntry.previousStatus).toBe("otp_verified");
    expect(deliveredEntry.changedBy.toString()).toBe(agent._id.toString());
    expect(deliveredEntry.changedByRole).toBe("delivery_agent");

    const firstEntry = history[0];
    expect(firstEntry.status).toBe("pending");
    expect(firstEntry.changedByRole).toBe("customer");
    void manager;
  });

  it("rejects invalid transitions and blocks updates on terminal statuses", async () => {
    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    const { token: managerToken } = await createAuthedUser({ role: "order_manager" });
    const { product } = await seedProduct();
    const variantId = product.variants[0]!._id!.toString();
    const order = await createTestOrder(customerToken, product._id.toString(), variantId);

    const skipAhead = await request(app)
      .patch(`/api/v1/orders/${order._id}/status`)
      .set(...authHeader(managerToken))
      .send({ status: "delivered" });
    expect(skipAhead.status).toBe(400);

    const cancelRes = await request(app)
      .patch(`/api/v1/orders/${order._id}/status`)
      .set(...authHeader(managerToken))
      .send({ status: "cancelled" });
    expect(cancelRes.status).toBe(200);

    const afterCancel = await request(app)
      .patch(`/api/v1/orders/${order._id}/status`)
      .set(...authHeader(managerToken))
      .send({ status: "confirmed" });
    expect(afterCancel.status).toBe(400);
  });

  it("lets admin override the actor-role gate but never the adjacency table", async () => {
    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { product } = await seedProduct();
    const variantId = product.variants[0]!._id!.toString();
    const order = await createTestOrder(customerToken, product._id.toString(), variantId);

    // admin isn't in GENERIC_STATUS_ACTOR_ROLES but bypasses the actor check
    const res = await request(app)
      .patch(`/api/v1/orders/${order._id}/status`)
      .set(...authHeader(adminToken))
      .send({ status: "confirmed" });
    expect(res.status).toBe(200);

    // but the adjacency table still applies — admin can't skip straight to delivered
    const invalid = await request(app)
      .patch(`/api/v1/orders/${order._id}/status`)
      .set(...authHeader(adminToken))
      .send({ status: "delivered" });
    expect(invalid.status).toBe(400);
  });

  it("enforces RBAC: order_manager and delivery_agent can't touch unrelated resources", async () => {
    const { token: managerToken } = await createAuthedUser({ role: "order_manager" });
    const { token: agentToken } = await createAuthedUser({ role: "delivery_agent" });

    const managerProducts = await request(app).post("/api/v1/products").set(...authHeader(managerToken)).send({});
    expect(managerProducts.status).toBe(403);

    const agentProducts = await request(app).post("/api/v1/products").set(...authHeader(agentToken)).send({});
    expect(agentProducts.status).toBe(403);

    const agentListOrders = await request(app).get("/api/v1/orders").set(...authHeader(agentToken));
    expect(agentListOrders.status).toBe(403);

    const agentUsers = await request(app).get("/api/v1/users").set(...authHeader(agentToken));
    expect(agentUsers.status).toBe(403);

    const agentAssigned = await request(app).get("/api/v1/orders/assigned-to-me").set(...authHeader(agentToken));
    expect(agentAssigned.status).toBe(200);
  });

  it("scopes a delivery agent strictly to their own assigned orders", async () => {
    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    const { token: managerToken } = await createAuthedUser({ role: "order_manager" });
    const { token: agentAToken, user: agentA } = await createAuthedUser({
      role: "delivery_agent",
      email: "agent-a@example.com",
    });
    const { token: agentBToken } = await createAuthedUser({ role: "delivery_agent", email: "agent-b@example.com" });
    const { product } = await seedProduct();
    const variantId = product.variants[0]!._id!.toString();
    const order = await createTestOrder(customerToken, product._id.toString(), variantId);

    for (const status of ["confirmed", "processing", "packed", "ready_for_dispatch"]) {
      await request(app)
        .patch(`/api/v1/orders/${order._id}/status`)
        .set(...authHeader(managerToken))
        .send({ status });
    }
    await request(app)
      .patch(`/api/v1/orders/${order._id}/assign-agent`)
      .set(...authHeader(managerToken))
      .send({ agentId: agentA._id.toString() });

    const agentBAttempt = await request(app)
      .patch(`/api/v1/orders/${order._id}/delivery-status`)
      .set(...authHeader(agentBToken))
      .send({ status: "picked_up" });
    expect(agentBAttempt.status).toBe(403);

    const agentAAssigned = await request(app).get("/api/v1/orders/assigned-to-me").set(...authHeader(agentAToken));
    expect(agentAAssigned.body.data.orders).toHaveLength(1);

    const agentBAssigned = await request(app).get("/api/v1/orders/assigned-to-me").set(...authHeader(agentBToken));
    expect(agentBAssigned.body.data.orders).toHaveLength(0);
  });

  it("surfaces the OTP only to the order owner while out_for_delivery, never to staff", async () => {
    const { token: customerToken, user: customer } = await createAuthedUser({ role: "customer" });
    const { token: managerToken } = await createAuthedUser({ role: "order_manager" });
    const { token: agentToken, user: agent } = await createAuthedUser({ role: "delivery_agent" });
    void customer;
    const { product } = await seedProduct();
    const variantId = product.variants[0]!._id!.toString();
    const order = await createTestOrder(customerToken, product._id.toString(), variantId);

    for (const status of ["confirmed", "processing", "packed", "ready_for_dispatch"]) {
      await request(app)
        .patch(`/api/v1/orders/${order._id}/status`)
        .set(...authHeader(managerToken))
        .send({ status });
    }
    await request(app)
      .patch(`/api/v1/orders/${order._id}/assign-agent`)
      .set(...authHeader(managerToken))
      .send({ agentId: agent._id.toString() });
    await request(app)
      .patch(`/api/v1/orders/${order._id}/delivery-status`)
      .set(...authHeader(agentToken))
      .send({ status: "picked_up" });
    await request(app)
      .patch(`/api/v1/orders/${order._id}/delivery-status`)
      .set(...authHeader(agentToken))
      .send({ status: "out_for_delivery" });

    const ownerView = await request(app).get(`/api/v1/orders/${order._id}`).set(...authHeader(customerToken));
    expect(ownerView.body.data.otp).toMatch(/^\d{6}$/);
    expect(ownerView.body.data.order.otpCode).toBeUndefined();

    const staffView = await request(app).get(`/api/v1/orders/${order._id}`).set(...authHeader(managerToken));
    expect(staffView.body.data.otp).toBeUndefined();
    expect(staffView.body.data.order.otpCode).toBeUndefined();

    const trackView = await request(app)
      .get("/api/v1/orders/track")
      .query({ orderNumber: order.orderNumber, email: shippingAddress.email });
    expect(trackView.body.data.otp).toMatch(/^\d{6}$/);
  });

  it("validates delivery-agent assignment (role and order-status guards)", async () => {
    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    const { token: managerToken } = await createAuthedUser({ role: "order_manager" });
    const { user: employee } = await createAuthedUser({ role: "employee" });
    const { user: agent } = await createAuthedUser({ role: "delivery_agent" });
    const { product } = await seedProduct();
    const variantId = product.variants[0]!._id!.toString();
    const order = await createTestOrder(customerToken, product._id.toString(), variantId);

    // Still "pending" — not ready for assignment yet.
    const tooEarly = await request(app)
      .patch(`/api/v1/orders/${order._id}/assign-agent`)
      .set(...authHeader(managerToken))
      .send({ agentId: agent._id.toString() });
    expect(tooEarly.status).toBe(400);

    for (const status of ["confirmed", "processing", "packed", "ready_for_dispatch"]) {
      await request(app)
        .patch(`/api/v1/orders/${order._id}/status`)
        .set(...authHeader(managerToken))
        .send({ status });
    }

    const wrongRole = await request(app)
      .patch(`/api/v1/orders/${order._id}/assign-agent`)
      .set(...authHeader(managerToken))
      .send({ agentId: employee._id.toString() });
    expect(wrongRole.status).toBe(400);

    const ok = await request(app)
      .patch(`/api/v1/orders/${order._id}/assign-agent`)
      .set(...authHeader(managerToken))
      .send({ agentId: agent._id.toString() });
    expect(ok.status).toBe(200);
  });
});

import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { CategoryModel } from "../../models/Category.model";
import { ProductModel } from "../../models/Product.model";
import { OrderModel } from "../../models/Order.model";

/**
 * End-to-end verification of the delivery workflow as a whole, complementing
 * `orderStatus.integration.test.ts` (which covers the status machine and OTP
 * rules in isolation). What this file asserts is the *cross-portal* behaviour:
 * that assigning an agent in the admin portal is what makes the order appear
 * in that agent's own dashboard, that each delivery hop the agent drives is
 * immediately visible to the customer on their own order, and that no role can
 * see or drive an order it has no business touching.
 */

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
    variants: [{ label: "500g", priceBDT: 1000, stock: 20, lowStockThreshold: 2 }],
  });
  return { product, variantId: product.variants[0]!._id!.toString() };
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

/** Walks an order up to `ready_for_dispatch`, the only status an agent can be assigned from. */
async function advanceToReadyForDispatch(orderId: string, staffToken: string) {
  for (const status of ["confirmed", "processing", "packed", "ready_for_dispatch"]) {
    const res = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set(...authHeader(staffToken))
      .send({ status });
    expect(res.status).toBe(200);
  }
}

describe("Delivery workflow across the admin, delivery-agent and customer portals", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("puts an order in the assigned agent's dashboard only once it is actually assigned", async () => {
    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: agentToken, user: agent } = await createAuthedUser({ role: "delivery_agent" });
    const { product, variantId } = await seedProduct();
    const order = await createTestOrder(customerToken, product._id.toString(), variantId);

    // Before assignment the agent's dashboard feed is empty, even though the
    // order exists and is progressing through the pipeline.
    const beforeAssign = await request(app)
      .get("/api/v1/orders/assigned-to-me")
      .set(...authHeader(agentToken));
    expect(beforeAssign.status).toBe(200);
    expect(beforeAssign.body.data.orders).toHaveLength(0);

    await advanceToReadyForDispatch(order._id, adminToken);
    await request(app)
      .patch(`/api/v1/orders/${order._id}/assign-agent`)
      .set(...authHeader(adminToken))
      .send({ agentId: agent._id.toString() })
      .expect(200);

    const afterAssign = await request(app)
      .get("/api/v1/orders/assigned-to-me")
      .set(...authHeader(agentToken));
    expect(afterAssign.status).toBe(200);
    expect(afterAssign.body.data.orders).toHaveLength(1);
    expect(afterAssign.body.data.orders[0]._id).toBe(order._id);
    expect(afterAssign.body.data.orders[0].status).toBe("assigned_to_agent");

    // The dashboard's status filter (used by its stat-card links) narrows the
    // same self-scoped feed rather than widening it.
    const filtered = await request(app)
      .get("/api/v1/orders/assigned-to-me?status=picked_up,out_for_delivery")
      .set(...authHeader(agentToken));
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.orders).toHaveLength(0);
  });

  it("syncs every delivery hop straight through to what the customer sees", async () => {
    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: agentToken, user: agent } = await createAuthedUser({ role: "delivery_agent" });
    const { product, variantId } = await seedProduct();
    const order = await createTestOrder(customerToken, product._id.toString(), variantId);

    await advanceToReadyForDispatch(order._id, adminToken);
    await request(app)
      .patch(`/api/v1/orders/${order._id}/assign-agent`)
      .set(...authHeader(adminToken))
      .send({ agentId: agent._id.toString() })
      .expect(200);

    /** What the customer's own order page / order history would render right now. */
    async function customerSeesStatus() {
      const res = await request(app)
        .get(`/api/v1/orders/${order._id}`)
        .set(...authHeader(customerToken));
      expect(res.status).toBe(200);
      return res.body.data as { order: { status: string; statusHistory: { status: string }[] }; otp?: string };
    }

    expect((await customerSeesStatus()).order.status).toBe("assigned_to_agent");

    await request(app)
      .patch(`/api/v1/orders/${order._id}/delivery-status`)
      .set(...authHeader(agentToken))
      .send({ status: "picked_up" })
      .expect(200);
    expect((await customerSeesStatus()).order.status).toBe("picked_up");

    await request(app)
      .patch(`/api/v1/orders/${order._id}/delivery-status`)
      .set(...authHeader(agentToken))
      .send({ status: "out_for_delivery" })
      .expect(200);

    const outForDelivery = await customerSeesStatus();
    expect(outForDelivery.order.status).toBe("out_for_delivery");
    // No OTP has been sent yet, so there is nothing for the customer to read
    // off their own tracking page.
    expect(outForDelivery.otp).toBeUndefined();

    await request(app)
      .post(`/api/v1/orders/${order._id}/send-delivery-otp`)
      .set(...authHeader(agentToken))
      .send({})
      .expect(200);

    // Once sent, the code is surfaced to the customer (and only the customer)
    // so they can read it out to the agent at the door.
    const withOtp = await customerSeesStatus();
    expect(withOtp.otp).toMatch(/^\d{4}$/);

    const dbOrder = await OrderModel.findById(order._id).select("+otpCode");
    await request(app)
      .post(`/api/v1/orders/${order._id}/verify-otp`)
      .set(...authHeader(agentToken))
      .send({ otp: dbOrder!.otpCode })
      .expect(200);

    const delivered = await customerSeesStatus();
    expect(delivered.order.status).toBe("delivered");
    expect(delivered.otp).toBeUndefined();
    // The customer's timeline shows every hop the agent drove, in order.
    const timeline = delivered.order.statusHistory.map((h) => h.status);
    expect(timeline).toEqual([
      "pending",
      "confirmed",
      "processing",
      "packed",
      "ready_for_dispatch",
      "assigned_to_agent",
      "picked_up",
      "out_for_delivery",
      "otp_verified",
      "delivered",
    ]);

    // The same progression is what the public order-tracking lookup reports.
    const tracked = await request(app).get(
      `/api/v1/orders/track?orderNumber=${order.orderNumber}&email=${encodeURIComponent(shippingAddress.email)}`
    );
    expect(tracked.status).toBe(200);
    expect(tracked.body.data.order.status).toBe("delivered");
  });

  it("lets a failed delivery be re-assigned, and re-scopes the order to the new agent", async () => {
    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: firstAgentToken, user: firstAgent } = await createAuthedUser({ role: "delivery_agent" });
    const { token: secondAgentToken, user: secondAgent } = await createAuthedUser({ role: "delivery_agent" });
    const { product, variantId } = await seedProduct();
    const order = await createTestOrder(customerToken, product._id.toString(), variantId);

    await advanceToReadyForDispatch(order._id, adminToken);
    await request(app)
      .patch(`/api/v1/orders/${order._id}/assign-agent`)
      .set(...authHeader(adminToken))
      .send({ agentId: firstAgent._id.toString() })
      .expect(200);
    await request(app)
      .patch(`/api/v1/orders/${order._id}/delivery-status`)
      .set(...authHeader(firstAgentToken))
      .send({ status: "picked_up" })
      .expect(200);
    await request(app)
      .patch(`/api/v1/orders/${order._id}/delivery-status`)
      .set(...authHeader(firstAgentToken))
      .send({ status: "out_for_delivery" })
      .expect(200);

    const failed = await request(app)
      .patch(`/api/v1/orders/${order._id}/delivery-failed`)
      .set(...authHeader(firstAgentToken))
      .send({ failureReason: "Customer unreachable at the address" });
    expect(failed.status).toBe(200);
    expect(failed.body.data.order.status).toBe("delivery_failed");

    // Re-assigning to a different agent moves the order back into the pipeline
    // and hands ownership over: the new agent can act on it, the old one can't.
    await request(app)
      .patch(`/api/v1/orders/${order._id}/assign-agent`)
      .set(...authHeader(adminToken))
      .send({ agentId: secondAgent._id.toString() })
      .expect(200);

    const oldAgentFeed = await request(app)
      .get("/api/v1/orders/assigned-to-me")
      .set(...authHeader(firstAgentToken));
    expect(oldAgentFeed.body.data.orders).toHaveLength(0);

    const newAgentFeed = await request(app)
      .get("/api/v1/orders/assigned-to-me")
      .set(...authHeader(secondAgentToken));
    expect(newAgentFeed.body.data.orders).toHaveLength(1);

    const oldAgentAttempt = await request(app)
      .patch(`/api/v1/orders/${order._id}/delivery-status`)
      .set(...authHeader(firstAgentToken))
      .send({ status: "picked_up" });
    expect(oldAgentAttempt.status).toBe(403);

    await request(app)
      .patch(`/api/v1/orders/${order._id}/delivery-status`)
      .set(...authHeader(secondAgentToken))
      .send({ status: "picked_up" })
      .expect(200);
  });

  it("isolates data by role: agents see only their own orders, and only staff see the full list", async () => {
    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    const { token: otherCustomerToken } = await createAuthedUser({ role: "customer" });
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
    const { token: managerToken } = await createAuthedUser({ role: "order_manager" });
    const { token: agentToken, user: agent } = await createAuthedUser({ role: "delivery_agent" });
    const { product, variantId } = await seedProduct();
    const order = await createTestOrder(customerToken, product._id.toString(), variantId);

    // Admin, Co-Admin and Order Manager all hold `orders.view` and see the
    // whole queue; a delivery agent has no access to it at all.
    for (const token of [adminToken, coAdminToken, managerToken]) {
      const res = await request(app)
        .get("/api/v1/orders")
        .set(...authHeader(token));
      expect(res.status).toBe(200);
      expect(res.body.data.orders).toHaveLength(1);
    }
    const agentListAttempt = await request(app)
      .get("/api/v1/orders")
      .set(...authHeader(agentToken));
    expect(agentListAttempt.status).toBe(403);

    // A customer never reaches another customer's order.
    const foreignCustomer = await request(app)
      .get(`/api/v1/orders/${order._id}`)
      .set(...authHeader(otherCustomerToken));
    expect(foreignCustomer.status).toBe(403);

    // An unassigned agent can neither read the order nor drive it.
    const unassignedRead = await request(app)
      .get(`/api/v1/orders/${order._id}`)
      .set(...authHeader(agentToken));
    expect(unassignedRead.status).toBe(403);
    const unassignedAct = await request(app)
      .patch(`/api/v1/orders/${order._id}/delivery-status`)
      .set(...authHeader(agentToken))
      .send({ status: "picked_up" });
    expect(unassignedAct.status).toBe(403);

    // Once assigned, the same agent can read that one order — and still not
    // the list endpoint.
    await advanceToReadyForDispatch(order._id, adminToken);
    await request(app)
      .patch(`/api/v1/orders/${order._id}/assign-agent`)
      .set(...authHeader(adminToken))
      .send({ agentId: agent._id.toString() })
      .expect(200);
    const assignedRead = await request(app)
      .get(`/api/v1/orders/${order._id}`)
      .set(...authHeader(agentToken));
    expect(assignedRead.status).toBe(200);
  });

  it("keeps delivery-only statuses off the generic staff endpoint for every staff role", async () => {
    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
    const { token: managerToken } = await createAuthedUser({ role: "order_manager" });
    const { token: agentToken, user: agent } = await createAuthedUser({ role: "delivery_agent" });
    const { product, variantId } = await seedProduct();
    const order = await createTestOrder(customerToken, product._id.toString(), variantId);
    await advanceToReadyForDispatch(order._id, adminToken);

    // Not even Super-Admin-adjacent roles can shortcut a delivery hop by
    // pushing the status directly — the dedicated agent endpoints are the
    // only way in, which is what makes OTP verification unskippable.
    for (const token of [adminToken, coAdminToken, managerToken]) {
      for (const status of ["picked_up", "out_for_delivery", "otp_verified", "delivered"]) {
        const res = await request(app)
          .patch(`/api/v1/orders/${order._id}/status`)
          .set(...authHeader(token))
          .send({ status });
        expect(res.status).toBe(400);
      }
    }

    // Co-Admin holds `orders.manage`, so it can assign an agent — the one
    // delivery-adjacent action open to non-delivery staff.
    const coAdminAssign = await request(app)
      .patch(`/api/v1/orders/${order._id}/assign-agent`)
      .set(...authHeader(coAdminToken))
      .send({ agentId: agent._id.toString() });
    expect(coAdminAssign.status).toBe(200);

    // A delivery agent cannot assign work to themselves or anyone else.
    const agentAssign = await request(app)
      .patch(`/api/v1/orders/${order._id}/assign-agent`)
      .set(...authHeader(agentToken))
      .send({ agentId: agent._id.toString() });
    expect(agentAssign.status).toBe(403);
  });
});

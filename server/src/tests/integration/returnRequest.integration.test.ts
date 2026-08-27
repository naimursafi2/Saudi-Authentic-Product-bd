import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { OrderModel, type IOrder } from "../../models/Order.model";
import { ReturnRequestModel } from "../../models/ReturnRequest.model";

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

async function seedOrder(customerId: string, status: IOrder["status"] = "delivered") {
  return OrderModel.create({
    orderNumber: `SAP-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
    customer: customerId,
    items: [
      {
        product: new Types.ObjectId(), // no real product needed — restockOrderItems no-ops on a miss
        productName: "Ajwa Dates",
        variantId: new Types.ObjectId().toString(),
        variantLabel: "500g",
        unitPriceBDT: 1000,
        quantity: 1,
        lineTotalBDT: 1000,
      },
    ],
    shippingAddress,
    deliveryMethod: "standard",
    shippingFeeBDT: 60,
    paymentMethod: "cod",
    isPaid: true,
    subtotalBDT: 1000,
    totalBDT: 1060,
    status,
  });
}

describe("Return / Exchange requests", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("lets a customer request a return only once their order is delivered", async () => {
    const { token, user } = await createAuthedUser({ role: "customer" });
    const pendingOrder = await seedOrder(user._id.toString(), "processing");

    const tooEarly = await request(app)
      .post("/api/v1/returns")
      .set(...authHeader(token))
      .send({ orderId: pendingOrder._id.toString(), type: "return", reasonCategory: "damaged" });
    expect(tooEarly.status).toBe(400);

    const deliveredOrder = await seedOrder(user._id.toString(), "delivered");
    const ok = await request(app)
      .post("/api/v1/returns")
      .set(...authHeader(token))
      .send({ orderId: deliveredOrder._id.toString(), type: "return", reasonCategory: "damaged", note: "Box was crushed" });
    expect(ok.status).toBe(201);
    expect(ok.body.data.request.status).toBe("pending");
  });

  it("rejects a duplicate pending request and a request on someone else's order", async () => {
    const { token: mine, user } = await createAuthedUser({ role: "customer" });
    const { token: theirs } = await createAuthedUser({ role: "customer" });
    const order = await seedOrder(user._id.toString(), "delivered");

    const first = await request(app)
      .post("/api/v1/returns")
      .set(...authHeader(mine))
      .send({ orderId: order._id.toString(), type: "return", reasonCategory: "damaged" });
    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post("/api/v1/returns")
      .set(...authHeader(mine))
      .send({ orderId: order._id.toString(), type: "return", reasonCategory: "wrong_item" });
    expect(duplicate.status).toBe(409);

    const notMine = await request(app)
      .post("/api/v1/returns")
      .set(...authHeader(theirs))
      .send({ orderId: order._id.toString(), type: "return", reasonCategory: "damaged" });
    expect(notMine.status).toBe(403);
  });

  it("scopes the list to the customer's own requests, and shows everything to staff", async () => {
    const { token: mine, user } = await createAuthedUser({ role: "customer" });
    const { token: theirs } = await createAuthedUser({ role: "customer" });
    const { token: staffToken } = await createAuthedUser({ role: "order_manager" });
    const order = await seedOrder(user._id.toString(), "delivered");

    await request(app)
      .post("/api/v1/returns")
      .set(...authHeader(mine))
      .send({ orderId: order._id.toString(), type: "exchange", reasonCategory: "wrong_item", desiredExchangeDetails: "Swap for the 1kg size" });

    const otherList = await request(app).get("/api/v1/returns").set(...authHeader(theirs));
    expect(otherList.body.data.requests).toHaveLength(0);

    const myList = await request(app).get("/api/v1/returns").set(...authHeader(mine));
    expect(myList.body.data.requests).toHaveLength(1);

    const staffList = await request(app).get("/api/v1/returns").set(...authHeader(staffToken));
    expect(staffList.body.data.requests).toHaveLength(1);
  });

  it("approving a return transitions the order to returned; approving an exchange does not", async () => {
    const { token: customerToken, user } = await createAuthedUser({ role: "customer" });
    const { token: managerToken, user: manager } = await createAuthedUser({ role: "order_manager" });

    const returnOrder = await seedOrder(user._id.toString(), "delivered");
    const returnReq = await request(app)
      .post("/api/v1/returns")
      .set(...authHeader(customerToken))
      .send({ orderId: returnOrder._id.toString(), type: "return", reasonCategory: "damaged" });

    const approveReturn = await request(app)
      .patch(`/api/v1/returns/${returnReq.body.data.request._id}/review`)
      .set(...authHeader(managerToken))
      .send({ decision: "approve", note: "Confirmed damage from photos" });
    expect(approveReturn.status).toBe(200);
    expect(approveReturn.body.data.request.status).toBe("approved");

    const updatedOrder = await OrderModel.findById(returnOrder._id);
    expect(updatedOrder?.status).toBe("returned");
    expect(updatedOrder?.statusHistory.at(-1)?.changedBy.toString()).toBe(manager._id.toString());

    const exchangeOrder = await seedOrder(user._id.toString(), "delivered");
    const exchangeReq = await request(app)
      .post("/api/v1/returns")
      .set(...authHeader(customerToken))
      .send({ orderId: exchangeOrder._id.toString(), type: "exchange", reasonCategory: "wrong_item", desiredExchangeDetails: "1kg instead of 500g" });

    const approveExchange = await request(app)
      .patch(`/api/v1/returns/${exchangeReq.body.data.request._id}/review`)
      .set(...authHeader(managerToken))
      .send({ decision: "approve" });
    expect(approveExchange.status).toBe(200);

    const untouchedOrder = await OrderModel.findById(exchangeOrder._id);
    expect(untouchedOrder?.status).toBe("delivered");
  });

  it("rejects a request without touching the order, and a second review is refused", async () => {
    const { token: customerToken, user } = await createAuthedUser({ role: "customer" });
    const { token: managerToken } = await createAuthedUser({ role: "order_manager" });
    const order = await seedOrder(user._id.toString(), "delivered");

    const req = await request(app)
      .post("/api/v1/returns")
      .set(...authHeader(customerToken))
      .send({ orderId: order._id.toString(), type: "return", reasonCategory: "changed_mind" });

    const reject = await request(app)
      .patch(`/api/v1/returns/${req.body.data.request._id}/review`)
      .set(...authHeader(managerToken))
      .send({ decision: "reject", note: "Outside the return window" });
    expect(reject.status).toBe(200);
    expect(reject.body.data.request.status).toBe("rejected");

    const stillDelivered = await OrderModel.findById(order._id);
    expect(stillDelivered?.status).toBe("delivered");

    const again = await request(app)
      .patch(`/api/v1/returns/${req.body.data.request._id}/review`)
      .set(...authHeader(managerToken))
      .send({ decision: "approve" });
    expect(again.status).toBe(400);

    expect(await ReturnRequestModel.countDocuments()).toBe(1);
  });

  it("a customer cannot review return requests", async () => {
    const { token: customerToken, user } = await createAuthedUser({ role: "customer" });
    const order = await seedOrder(user._id.toString(), "delivered");
    const req = await request(app)
      .post("/api/v1/returns")
      .set(...authHeader(customerToken))
      .send({ orderId: order._id.toString(), type: "return", reasonCategory: "damaged" });

    const res = await request(app)
      .patch(`/api/v1/returns/${req.body.data.request._id}/review`)
      .set(...authHeader(customerToken))
      .send({ decision: "approve" });
    expect(res.status).toBe(403);
  });
});

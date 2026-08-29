/**
 * Cloudinary is stubbed rather than configured — same reasoning as
 * heroSlide/productFeatures integration tests: uploads are guarded by
 * `isCloudinaryConfigured`, so the real module would reject an expense's
 * cash-memo photo with a 503 in the test environment.
 */
const uploadBufferToCloudinary = jest
  .fn()
  .mockResolvedValue({ url: "https://cdn.test/cash-memo.jpg", publicId: "expense-cash-memos/photo" });

jest.mock("../../config/cloudinary", () => ({
  uploadBufferToCloudinary: (...args: unknown[]) => uploadBufferToCloudinary(...args),
  deleteCloudinaryImage: jest.fn().mockResolvedValue(undefined),
}));

import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { CategoryModel } from "../../models/Category.model";
import { ProductModel } from "../../models/Product.model";
import { OrderModel } from "../../models/Order.model";
import { ExpenseModel } from "../../models/Expense.model";

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
  return ProductModel.create({
    name: "Ajwa Dates",
    slug: "ajwa-dates",
    tagline: "Rich, soft Madinah dates",
    description: "Premium Ajwa dates.",
    origin: "Madinah",
    categories: [category._id],
    variants: [{ label: "500g", priceBDT: 1000, stock: 5, lowStockThreshold: 2 }],
  });
}

/** Walks a fresh order all the way to "returned", reusing the real endpoints
 * from the order/delivery pipeline (see orderStatus.integration.test.ts). */
async function createReturnedOrder() {
  const { token: customerToken, user: customer } = await createAuthedUser({ role: "customer" });
  const { token: managerToken } = await createAuthedUser({ role: "order_manager" });
  const { token: agentToken, user: agent } = await createAuthedUser({ role: "delivery_agent" });
  const product = await seedProduct();
  const variantId = product.variants[0]!._id!.toString();

  const createRes = await request(app)
    .post("/api/v1/orders")
    .set(...authHeader(customerToken))
    .send({
      items: [{ productId: product._id.toString(), variantId, quantity: 1 }],
      shippingAddress,
      deliveryMethod: "standard",
      paymentMethod: "cod",
    });
  const order = createRes.body.data.order as { _id: string };

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
  await request(app)
    .post(`/api/v1/orders/${order._id}/send-delivery-otp`)
    .set(...authHeader(agentToken))
    .send({});

  const dbOrder = await OrderModel.findById(order._id).select("+otpCode");
  await request(app)
    .post(`/api/v1/orders/${order._id}/verify-otp`)
    .set(...authHeader(agentToken))
    .send({ otp: dbOrder!.otpCode });

  await request(app)
    .patch(`/api/v1/orders/${order._id}/status`)
    .set(...authHeader(managerToken))
    .send({ status: "returned" });

  return { orderId: order._id, customer, customerToken, managerToken };
}

describe("Finance module (Investment, Expense, Refund)", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("only super_admin can record an investment; admin can view, co_admin has no access", async () => {
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });

    const asAdmin = await request(app)
      .post("/api/v1/investments")
      .set(...authHeader(adminToken))
      .send({ investorName: "Partner A", amountBDT: 100000 });
    expect(asAdmin.status).toBe(403);

    const asSuperAdmin = await request(app)
      .post("/api/v1/investments")
      .set(...authHeader(superAdminToken))
      .send({ investorName: "Partner A", amountBDT: 100000 });
    expect(asSuperAdmin.status).toBe(201);

    const adminList = await request(app).get("/api/v1/investments").set(...authHeader(adminToken));
    expect(adminList.status).toBe(200);
    expect(adminList.body.data.investments).toHaveLength(1);

    const coAdminList = await request(app).get("/api/v1/investments").set(...authHeader(coAdminToken));
    expect(coAdminList.status).toBe(403);
  });

  it("requires a reason, and requires otherCategoryDetail only for the Other category", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });

    const missingReason = await request(app)
      .post("/api/v1/expenses")
      .set(...authHeader(adminToken))
      .send({ category: "packaging", amountBDT: 500 });
    expect(missingReason.status).toBe(400);

    const otherWithoutDetail = await request(app)
      .post("/api/v1/expenses")
      .set(...authHeader(adminToken))
      .send({ category: "other", amountBDT: 500, reason: "Miscellaneous" });
    expect(otherWithoutDetail.status).toBe(400);

    const otherWithDetail = await request(app)
      .post("/api/v1/expenses")
      .set(...authHeader(adminToken))
      .send({
        category: "other",
        amountBDT: 500,
        reason: "Miscellaneous",
        otherCategoryDetail: "Office plants",
      });
    expect(otherWithDetail.status).toBe(201);
    expect(otherWithDetail.body.data.expense.otherCategoryDetail).toBe("Office plants");

    const nonOtherCategory = await request(app)
      .post("/api/v1/expenses")
      .set(...authHeader(adminToken))
      .send({ category: "packaging", amountBDT: 500, reason: "Boxes" });
    expect(nonOtherCategory.status).toBe(201);
  });

  it("uploads an optional cash-memo photo to Cloudinary and shows who requested the expense", async () => {
    const { token: coAdminToken, user: coAdmin } = await createAuthedUser({ role: "co_admin" });
    const { token: adminToken } = await createAuthedUser({ role: "admin" });

    const created = await request(app)
      .post("/api/v1/expenses")
      .set(...authHeader(coAdminToken))
      .field("category", "delivery")
      .field("amountBDT", "1200")
      .field("reason", "Courier fee for bulk shipment")
      .attach("cashMemo", Buffer.from("fake-memo-bytes"), "memo.png");

    expect(created.status).toBe(201);
    expect(created.body.data.expense.cashMemo.url).toBe("https://cdn.test/cash-memo.jpg");
    expect(uploadBufferToCloudinary).toHaveBeenCalledTimes(1);

    const list = await request(app).get("/api/v1/expenses").set(...authHeader(adminToken));
    const listed = list.body.data.expenses.find((e: { _id: string }) => e._id === created.body.data.expense._id);
    expect(listed.recordedBy.name).toBe(coAdmin.name);
    expect(listed.cashMemo.url).toBe("https://cdn.test/cash-memo.jpg");
  });

  it("auto-confirms admin/super_admin expenses but leaves co_admin submissions pending", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });

    const asAdmin = await request(app)
      .post("/api/v1/expenses")
      .set(...authHeader(adminToken))
      .send({ category: "packaging", amountBDT: 1500, reason: "Boxes for Q1 shipments" });
    expect(asAdmin.status).toBe(201);
    expect(asAdmin.body.data.expense.status).toBe("confirmed");

    const asCoAdmin = await request(app)
      .post("/api/v1/expenses")
      .set(...authHeader(coAdminToken))
      .send({ category: "packaging", amountBDT: 1500, reason: "Boxes for Q1 shipments" });
    expect(asCoAdmin.status).toBe(201);
    expect(asCoAdmin.body.data.expense.status).toBe("pending");
  });

  it("routes a co_admin expense above the threshold through the approval gate, blocking direct admin confirmation", async () => {
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });

    const submitted = await request(app)
      .post("/api/v1/expenses")
      .set(...authHeader(coAdminToken))
      .send({ category: "marketing", amountBDT: 5000, reason: "Eid campaign ads" }); // above the 2000 default threshold
    expect(submitted.status).toBe(201);
    const expenseId = submitted.body.data.expense._id;

    // Admin cannot confirm an over-threshold expense directly.
    const directConfirm = await request(app)
      .patch(`/api/v1/expenses/${expenseId}/confirm`)
      .set(...authHeader(adminToken))
      .send({});
    expect(directConfirm.status).toBe(403);

    const pending = await request(app)
      .get("/api/v1/pending-actions")
      .set(...authHeader(superAdminToken))
      .query({ actionType: "expense.confirm" });
    expect(pending.body.data.actions).toHaveLength(1);

    const grant = await request(app)
      .patch(`/api/v1/pending-actions/${pending.body.data.actions[0]._id}/grant`)
      .set(...authHeader(superAdminToken))
      .send({});
    expect(grant.status).toBe(200);

    const confirmed = await ExpenseModel.findById(expenseId);
    expect(confirmed?.status).toBe("confirmed");
  });

  it("walks a full refund from request through Order-Manager review to Admin approval, refunding the order and logging an expense", async () => {
    const { orderId, customer, managerToken } = await createReturnedOrder();
    const { token: adminToken } = await createAuthedUser({ role: "admin" });

    const requestRes = await request(app)
      .post("/api/v1/refunds")
      .set(...authHeader(managerToken))
      .send({ orderId, reasonCategory: "damaged", requestedAmountBDT: 1000 });
    expect(requestRes.status).toBe(201);
    expect(requestRes.body.data.refund.status).toBe("pending_review");
    const refundId = requestRes.body.data.refund._id;

    const reviewRes = await request(app)
      .patch(`/api/v1/refunds/${refundId}/review`)
      .set(...authHeader(managerToken))
      .send({ decision: "approve" });
    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.data.refund.status).toBe("pending_approval");

    const approveRes = await request(app)
      .patch(`/api/v1/refunds/${refundId}/approve`)
      .set(...authHeader(adminToken))
      .send({});
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.refund.status).toBe("approved");

    const order = await OrderModel.findById(orderId);
    expect(order?.status).toBe("refunded");

    const linkedExpense = await ExpenseModel.findOne({ linkedRefund: refundId });
    expect(linkedExpense).not.toBeNull();
    expect(linkedExpense?.status).toBe("confirmed");
    expect(linkedExpense?.amountBDT).toBe(1000);
    void customer;
  });

  it("routes an admin's above-threshold refund approval through the grant workflow", async () => {
    const { orderId, managerToken } = await createReturnedOrder();
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });

    const requestRes = await request(app)
      .post("/api/v1/refunds")
      .set(...authHeader(managerToken))
      .send({ orderId, reasonCategory: "not_as_described", requestedAmountBDT: 10000 }); // above the 5000 default threshold
    const refundId = requestRes.body.data.refund._id;

    await request(app)
      .patch(`/api/v1/refunds/${refundId}/review`)
      .set(...authHeader(managerToken))
      .send({ decision: "approve" });

    const adminAttempt = await request(app)
      .patch(`/api/v1/refunds/${refundId}/approve`)
      .set(...authHeader(adminToken))
      .send({});
    expect(adminAttempt.status).toBe(202);
    expect(adminAttempt.body.data.pendingActionId).toBeTruthy();

    // Not yet applied.
    let order = await OrderModel.findById(orderId);
    expect(order?.status).toBe("returned");

    const grant = await request(app)
      .patch(`/api/v1/pending-actions/${adminAttempt.body.data.pendingActionId}/grant`)
      .set(...authHeader(superAdminToken))
      .send({});
    expect(grant.status).toBe(200);

    order = await OrderModel.findById(orderId);
    expect(order?.status).toBe("refunded");
  });

  it("always requires a Super Admin grant for a co_admin's refund request, regardless of amount", async () => {
    const { orderId } = await createReturnedOrder();
    const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });

    const res = await request(app)
      .post("/api/v1/refunds")
      .set(...authHeader(coAdminToken))
      .send({ orderId, reasonCategory: "other", requestedAmountBDT: 500, note: "Customer changed their mind" });
    expect(res.status).toBe(202);

    const grant = await request(app)
      .patch(`/api/v1/pending-actions/${res.body.data.pendingActionId}/grant`)
      .set(...authHeader(superAdminToken))
      .send({});
    expect(grant.status).toBe(200);

    const listRes = await request(app)
      .get("/api/v1/refunds")
      .set(...authHeader(superAdminToken));
    expect(listRes.body.data.refunds).toHaveLength(1);
    expect(listRes.body.data.refunds[0].status).toBe("pending_review");
  });

  it("lets a customer request a refund on their own returned order and see only their own refunds", async () => {
    const { orderId, customerToken } = await createReturnedOrder();
    const { token: otherCustomerToken } = await createAuthedUser({ role: "customer" });

    const requestRes = await request(app)
      .post("/api/v1/refunds")
      .set(...authHeader(customerToken))
      .send({ orderId, reasonCategory: "damaged", requestedAmountBDT: 1000 });
    expect(requestRes.status).toBe(201);
    expect(requestRes.body.data.refund.status).toBe("pending_review");

    const ownList = await request(app).get("/api/v1/refunds").set(...authHeader(customerToken));
    expect(ownList.status).toBe(200);
    expect(ownList.body.data.refunds).toHaveLength(1);

    const otherList = await request(app).get("/api/v1/refunds").set(...authHeader(otherCustomerToken));
    expect(otherList.status).toBe(200);
    expect(otherList.body.data.refunds).toHaveLength(0);
  });

  it("exposes a finance summary to admin/super_admin only, combining revenue, investment, and confirmed expenses", async () => {
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
    const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });

    await request(app)
      .post("/api/v1/investments")
      .set(...authHeader(superAdminToken))
      .send({ investorName: "Partner A", amountBDT: 50000 });
    await request(app)
      .post("/api/v1/expenses")
      .set(...authHeader(superAdminToken))
      .send({ category: "software", amountBDT: 2000, reason: "Annual subscription renewal" });

    const blocked = await request(app).get("/api/v1/finance/summary").set(...authHeader(coAdminToken));
    expect(blocked.status).toBe(403);

    const summary = await request(app).get("/api/v1/finance/summary").set(...authHeader(superAdminToken));
    expect(summary.status).toBe(200);
    expect(summary.body.data.summary.totalInvestmentBDT).toBe(50000);
    expect(summary.body.data.summary.totalExpensesBDT).toBe(2000);
    // Net profit is gross profit (net selling revenue minus cost of goods
    // sold) minus operating expenses — not revenue minus expenses. With no
    // orders in this test both revenue sides are zero, so the whole ৳2,000
    // expense is the loss. See profitAndLoss.integration.test.ts for the
    // version of this with real sales and purchase batches behind it.
    expect(summary.body.data.summary.grossProfitBDT).toBe(0);
    expect(summary.body.data.summary.netProfitBDT).toBe(-2000);
  });
});

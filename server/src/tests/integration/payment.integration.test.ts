/**
 * The SSLCommerz gateway client is stubbed here: the test environment never
 * talks to the real gateway (see `isSslcommerzConfigured` in config/env.ts),
 * and mocking lets each test dictate exactly what SSLCommerz "replies" —
 * the only way to exercise the fraud paths (a settled amount that doesn't
 * match the order, a forged success/cancel post, a replayed callback). Mock
 * first, import the app after, so the service picks up the stub.
 */
const initSslcommerzPayment = jest.fn();
const validateSslcommerzPayment = jest.fn();
const querySslcommerzTransaction = jest.fn();

jest.mock("../../config/sslcommerz", () => ({
  isSslcommerzConfigured: true,
  isSuccessfulStatus: (status: string | undefined) => status === "VALID" || status === "VALIDATED",
  initSslcommerzPayment: (...args: unknown[]) => initSslcommerzPayment(...args),
  validateSslcommerzPayment: (...args: unknown[]) => validateSslcommerzPayment(...args),
  querySslcommerzTransaction: (...args: unknown[]) => querySslcommerzTransaction(...args),
}));

import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { CategoryModel } from "../../models/Category.model";
import { ProductModel } from "../../models/Product.model";
import { OrderModel } from "../../models/Order.model";
import { PaymentModel } from "../../models/Payment.model";
import { CouponModel } from "../../models/Coupon.model";
import { runPaymentReconciliationTick } from "../../services/scheduler.service";

const app = createApp();

const CALLBACK = "/api/v1/payments/sslcommerz";

const shippingAddress = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane.doe@example.com",
  phone: "+8801812345678",
  fullAddress: "House 1, Road 2",
  district: "Dhaka",
  cityArea: "Gulshan",
};

let seedCounter = 0;
async function seedProduct() {
  seedCounter += 1;
  const category = await CategoryModel.findOneAndUpdate(
    { slug: "dates" },
    { $setOnInsert: { name: "Dates", slug: "dates" } },
    { upsert: true, returnDocument: "after" }
  );
  return ProductModel.create({
    name: `Ajwa Dates ${seedCounter}`,
    slug: `ajwa-dates-${seedCounter}`,
    tagline: "Rich, soft Madinah dates",
    description: "Premium Ajwa dates.",
    origin: "Madinah",
    categories: [category!._id],
    variants: [{ label: "500g", priceBDT: 1000, stock: 10, lowStockThreshold: 2 }],
  });
}

/** Places a real online-payment order through the API so every figure is server-computed. 2 x ৳1000 + ৳60 = ৳2060. */
async function placeOnlineOrder(token: string, quantity = 2, extra: Record<string, unknown> = {}) {
  const product = await seedProduct();
  const res = await request(app)
    .post("/api/v1/orders")
    .set(...authHeader(token))
    .send({
      items: [{ productId: product._id.toString(), variantId: product.variants[0]!._id!.toString(), quantity }],
      shippingAddress,
      deliveryMethod: "standard",
      paymentMethod: "sslcommerz",
      ...extra,
    });
  expect(res.status).toBe(201);
  // Checkout now opens a gateway session in the same request. These tests
  // exercise the explicit "Pay Now" path, so start each one from a clean slate.
  await PaymentModel.deleteMany({ order: res.body.data.order._id });
  initSslcommerzPayment.mockReset();
  return { product, order: res.body.data.order as { _id: string; orderNumber: string; totalBDT: number } };
}

function stubInit() {
  initSslcommerzPayment.mockImplementation(async (input: { tranId: string }) => ({
    gatewayUrl: `https://sandbox.sslcommerz.test/gwprocess/v4/gw.php?Q=pay&SESSIONKEY=${input.tranId}`,
    sessionKey: "SESSION",
  }));
}

/** Starts a payment through the API and returns its tran_id. */
async function startPayment(token: string, orderId: string): Promise<string> {
  stubInit();
  const res = await request(app)
    .post(`${CALLBACK}/init`)
    .set(...authHeader(token))
    .send({ orderId });
  expect(res.status).toBe(201);
  return res.body.data.payment.gatewayPaymentId as string;
}

function validResult(tranId: string, overrides: Record<string, unknown> = {}) {
  return {
    status: "VALID",
    tranId,
    valId: "VAL123",
    amount: "2060.00",
    currency: "BDT",
    bankTranId: "BNK7X2QK91",
    riskLevel: "0",
    ...overrides,
  };
}

/** Backdates a payment's `createdAt` via the raw driver (Mongoose treats it as immutable). */
async function agePayment(gatewayPaymentId: string, ageMs: number) {
  await PaymentModel.collection.updateOne(
    { gatewayPaymentId },
    { $set: { createdAt: new Date(Date.now() - ageMs) } }
  );
}

function redirectPath(res: request.Response): string {
  return new URL(res.headers.location as string).pathname;
}

describe("SSLCommerz payment integration", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
    jest.resetAllMocks();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("opens a session for the server-computed order total, never a client-supplied amount", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order } = await placeOnlineOrder(token);
    stubInit();

    const res = await request(app)
      .post(`${CALLBACK}/init`)
      .set(...authHeader(token))
      .send({ orderId: order._id, amount: 1, total_amount: 1 });

    expect(res.status).toBe(201);
    expect(res.body.data.payment.amountBDT).toBe(2060);
    expect(res.body.data.payment.gatewayUrl).toContain("sslcommerz");
    expect(initSslcommerzPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amountBDT: 2060,
        tranId: expect.stringContaining(order.orderNumber),
        successUrl: expect.stringContaining("/payments/sslcommerz/success"),
        failUrl: expect.stringContaining("/payments/sslcommerz/fail"),
        cancelUrl: expect.stringContaining("/payments/sslcommerz/cancel"),
        ipnUrl: expect.stringContaining("/payments/sslcommerz/ipn"),
      })
    );
    // Credentials never appear in what the browser gets back.
    expect(JSON.stringify(res.body)).not.toMatch(/store_?passw|store_?id/i);
  });

  it("verifies a success callback with SSLCommerz, marks the order paid and redirects to the success page", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order } = await placeOnlineOrder(token);
    const tranId = await startPayment(token, order._id);
    validateSslcommerzPayment.mockResolvedValue(validResult(tranId));

    // A cross-site form POST from the gateway's own domain — must not be
    // blocked by the CORS allow-list.
    const res = await request(app)
      .post(`${CALLBACK}/success`)
      .set("Origin", "https://sandbox.sslcommerz.com")
      .type("form")
      .send({ tran_id: tranId, val_id: "VAL123", status: "VALID", amount: "2060.00" });

    expect(res.status).toBe(303);
    expect(redirectPath(res)).toBe("/checkout/payment/success");
    expect(res.headers.location).toContain(`order=${order.orderNumber}`);
    expect(validateSslcommerzPayment).toHaveBeenCalledWith("VAL123");

    const payment = await PaymentModel.findOne({ gatewayPaymentId: tranId });
    expect(payment?.status).toBe("paid");
    expect(payment?.transactionId).toBe("BNK7X2QK91");

    const stored = await OrderModel.findById(order._id);
    expect(stored?.isPaid).toBe(true);
    expect(stored?.status).toBe("confirmed");
  });

  it("is idempotent — a replayed success callback or IPN neither re-confirms the order nor double-deducts stock", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order, product } = await placeOnlineOrder(token);
    const tranId = await startPayment(token, order._id);
    validateSslcommerzPayment.mockResolvedValue(validResult(tranId, { status: "VALIDATED" }));

    const body = { tran_id: tranId, val_id: "VAL123", status: "VALID" };
    const first = await request(app).post(`${CALLBACK}/success`).type("form").send(body);
    const second = await request(app).post(`${CALLBACK}/success`).type("form").send(body);
    const ipn = await request(app).post(`${CALLBACK}/ipn`).type("form").send(body);

    expect(redirectPath(first)).toBe("/checkout/payment/success");
    expect(redirectPath(second)).toBe("/checkout/payment/success");
    expect(ipn.status).toBe(200);

    const stored = await OrderModel.findById(order._id);
    expect(stored?.statusHistory.filter((h) => h.status === "confirmed")).toHaveLength(1);
    expect((await ProductModel.findById(product._id))?.variants[0]?.stock).toBe(8);
    expect(await PaymentModel.countDocuments({ status: "paid" })).toBe(1);
  });

  it("rejects a validated transaction whose amount does not match the order total", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order } = await placeOnlineOrder(token);
    const tranId = await startPayment(token, order._id);
    validateSslcommerzPayment.mockResolvedValue(validResult(tranId, { amount: "10.00" }));

    const res = await request(app)
      .post(`${CALLBACK}/success`)
      .type("form")
      .send({ tran_id: tranId, val_id: "VAL123", amount: "2060.00" });

    expect(redirectPath(res)).toBe("/checkout/payment/failed");
    expect((await PaymentModel.findOne({ gatewayPaymentId: tranId }))?.status).toBe("failed");
    expect((await OrderModel.findById(order._id))?.isPaid).toBe(false);
  });

  it("rejects a val_id that belongs to a different transaction", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order } = await placeOnlineOrder(token);
    const tranId = await startPayment(token, order._id);
    // A real, valid val_id — but from someone else's (cheaper) payment.
    validateSslcommerzPayment.mockResolvedValue(validResult("SAP-OTHER-ORDER-abc123"));

    const res = await request(app)
      .post(`${CALLBACK}/success`)
      .type("form")
      .send({ tran_id: tranId, val_id: "STOLEN" });

    expect(redirectPath(res)).toBe("/checkout/payment/failed");
    expect((await OrderModel.findById(order._id))?.isPaid).toBe(false);
  });

  it("never trusts a forged success post — SSLCommerz's validation API has the final say", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order } = await placeOnlineOrder(token);
    const tranId = await startPayment(token, order._id);
    validateSslcommerzPayment.mockResolvedValue({ status: "INVALID_TRANSACTION" });

    const res = await request(app)
      .post(`${CALLBACK}/success`)
      .type("form")
      .send({ tran_id: tranId, val_id: "FORGED", status: "VALID", amount: "2060.00" });

    expect(redirectPath(res)).toBe("/checkout/payment/failed");
    expect((await OrderModel.findById(order._id))?.isPaid).toBe(false);
  });

  it("redirects an unknown transaction to the failed page without touching anything", async () => {
    const res = await request(app)
      .post(`${CALLBACK}/success`)
      .type("form")
      .send({ tran_id: "NOPE-123", val_id: "X" });
    expect(redirectPath(res)).toBe("/checkout/payment/failed");
    expect(validateSslcommerzPayment).not.toHaveBeenCalled();
  });

  it("closes a cancelled payment only after SSLCommerz confirms it was not paid", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order } = await placeOnlineOrder(token);
    const tranId = await startPayment(token, order._id);
    querySslcommerzTransaction.mockResolvedValue([{ status: "CANCELLED", tranId }]);

    const res = await request(app).post(`${CALLBACK}/cancel`).type("form").send({ tran_id: tranId });

    expect(redirectPath(res)).toBe("/checkout/payment/cancelled");
    expect(querySslcommerzTransaction).toHaveBeenCalledWith(tranId);
    expect((await PaymentModel.findOne({ gatewayPaymentId: tranId }))?.status).toBe("cancelled");
    expect((await OrderModel.findById(order._id))?.isPaid).toBe(false);
  });

  it("a forged cancel post cannot void a payment SSLCommerz says was actually paid", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order } = await placeOnlineOrder(token);
    const tranId = await startPayment(token, order._id);
    querySslcommerzTransaction.mockResolvedValue([validResult(tranId)]);
    validateSslcommerzPayment.mockResolvedValue(validResult(tranId));

    const res = await request(app).post(`${CALLBACK}/cancel`).type("form").send({ tran_id: tranId });

    expect(redirectPath(res)).toBe("/checkout/payment/success");
    expect((await OrderModel.findById(order._id))?.isPaid).toBe(true);
  });

  it("marks a failed payment failed and redirects to the failed page", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order } = await placeOnlineOrder(token);
    const tranId = await startPayment(token, order._id);
    querySslcommerzTransaction.mockResolvedValue([{ status: "FAILED", tranId, error: "Declined" }]);

    const res = await request(app).post(`${CALLBACK}/fail`).type("form").send({ tran_id: tranId });

    expect(redirectPath(res)).toBe("/checkout/payment/failed");
    expect((await PaymentModel.findOne({ gatewayPaymentId: tranId }))?.status).toBe("failed");
  });

  it("refuses to start a payment on someone else's order, or a second one on a paid order", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { token: otherToken } = await createAuthedUser({ role: "customer" });
    const { order } = await placeOnlineOrder(token);
    stubInit();

    const foreign = await request(app)
      .post(`${CALLBACK}/init`)
      .set(...authHeader(otherToken))
      .send({ orderId: order._id });
    expect(foreign.status).toBe(403);

    await OrderModel.updateOne({ _id: order._id }, { isPaid: true });
    const paid = await request(app)
      .post(`${CALLBACK}/init`)
      .set(...authHeader(token))
      .send({ orderId: order._id });
    expect(paid.status).toBe(409);
  });

  it("refuses online payment for a cash-on-delivery order", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order } = await placeOnlineOrder(token, 1, { paymentMethod: "cod" });
    stubInit();
    const res = await request(app)
      .post(`${CALLBACK}/init`)
      .set(...authHeader(token))
      .send({ orderId: order._id });
    expect(res.status).toBe(400);
  });

  it("opens the gateway session in the same checkout request and returns its URL", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const product = await seedProduct();
    stubInit();
    const res = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(token))
      .send({
        items: [{ productId: product._id.toString(), variantId: product.variants[0]!._id!.toString(), quantity: 1 }],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "sslcommerz",
      });
    expect(res.status).toBe(201);
    expect(res.body.data.payment.gatewayUrl).toContain("sandbox.sslcommerz.test");
    expect(initSslcommerzPayment).toHaveBeenCalledTimes(1);
    expect(await PaymentModel.countDocuments({ order: res.body.data.order._id, status: "initiated" })).toBe(1);
  });

  it("still places the order when the gateway can't be reached at checkout", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const product = await seedProduct();
    initSslcommerzPayment.mockRejectedValue(new Error("gateway down"));
    const res = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(token))
      .send({
        items: [{ productId: product._id.toString(), variantId: product.variants[0]!._id!.toString(), quantity: 1 }],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "sslcommerz",
      });
    expect(res.status).toBe(201);
    expect(res.body.data.order.orderNumber).toBeTruthy();
    expect(res.body.data.payment).toBeUndefined();
  });

  it("reuses one gateway session across repeated Pay Now clicks", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order } = await placeOnlineOrder(token);
    const first = await startPayment(token, order._id);
    const second = await startPayment(token, order._id);

    expect(second).toBe(first);
    expect(initSslcommerzPayment).toHaveBeenCalledTimes(1);
    expect(await PaymentModel.countDocuments({ order: order._id })).toBe(1);
  });

  it("gates the staff payment list on payments.view, and exposes no way to settle a payment by hand", async () => {
    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    const { token: managerToken } = await createAuthedUser({ role: "order_manager" });
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });

    expect((await request(app).get("/api/v1/payments").set(...authHeader(customerToken))).status).toBe(403);
    expect((await request(app).get("/api/v1/payments").set(...authHeader(managerToken))).status).toBe(200);

    const someId = "0123456789abcdef01234567";
    expect(
      (await request(app).post(`/api/v1/payments/${someId}/verify`).set(...authHeader(superToken))).status
    ).toBe(404);
  });

  it("automatically reconciles a payment whose customer never made it back", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order } = await placeOnlineOrder(token);
    const tranId = await startPayment(token, order._id);
    await agePayment(tranId, 20 * 60 * 1000);
    querySslcommerzTransaction.mockResolvedValue([validResult(tranId)]);
    validateSslcommerzPayment.mockResolvedValue(validResult(tranId));

    await runPaymentReconciliationTick();

    expect((await PaymentModel.findOne({ gatewayPaymentId: tranId }))?.status).toBe("paid");
    expect((await OrderModel.findById(order._id))?.isPaid).toBe(true);
  });

  it("leaves a fresh unfinished payment alone, so the sweep never races the customer", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order } = await placeOnlineOrder(token);
    await startPayment(token, order._id);

    await runPaymentReconciliationTick();

    expect(querySslcommerzTransaction).not.toHaveBeenCalled();
  });

  it("holds off failing a slow customer, then abandons the payment past the checkout window", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order } = await placeOnlineOrder(token);
    const tranId = await startPayment(token, order._id);
    querySslcommerzTransaction.mockResolvedValue([{ status: "PENDING", tranId }]);

    await agePayment(tranId, 20 * 60 * 1000);
    await runPaymentReconciliationTick();
    expect((await PaymentModel.findOne({ gatewayPaymentId: tranId }))?.status).toBe("initiated");

    await agePayment(tranId, 50 * 60 * 1000);
    await runPaymentReconciliationTick();
    expect((await PaymentModel.findOne({ gatewayPaymentId: tranId }))?.status).toBe("failed");
  });

  it("keeps sweeping after one payment's gateway call fails", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order: a } = await placeOnlineOrder(token);
    const { order: b } = await placeOnlineOrder(token);
    const tranA = await startPayment(token, a._id);
    const tranB = await startPayment(token, b._id);
    await agePayment(tranA, 20 * 60 * 1000);
    await agePayment(tranB, 20 * 60 * 1000);

    querySslcommerzTransaction.mockImplementation(async (tranId: string) => {
      if (tranId === tranA) throw new Error("gateway down");
      return [validResult(tranId)];
    });
    validateSslcommerzPayment.mockResolvedValue(validResult(tranB));

    await runPaymentReconciliationTick();

    expect((await PaymentModel.findOne({ gatewayPaymentId: tranA }))?.status).toBe("initiated");
    expect((await PaymentModel.findOne({ gatewayPaymentId: tranB }))?.status).toBe("paid");
  });

  it("exposes an order's payment to its owner but not to an unrelated customer", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { token: otherToken } = await createAuthedUser({ role: "customer" });
    const { order } = await placeOnlineOrder(token);
    await startPayment(token, order._id);

    const owner = await request(app).get(`/api/v1/payments/order/${order._id}`).set(...authHeader(token));
    expect(owner.status).toBe(200);
    expect(owner.body.data.payment.status).toBe("initiated");

    const stranger = await request(app)
      .get(`/api/v1/payments/order/${order._id}`)
      .set(...authHeader(otherToken));
    expect(stranger.status).toBe(403);
  });

  it("charges the discounted total when a coupon applies, and rejects a settlement for the undiscounted amount", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    await CouponModel.create({
      code: "SAVE20",
      discountType: "percentage",
      discountValue: 20,
      startsAt: new Date(Date.now() - 3600_000),
      expiresAt: new Date(Date.now() + 3600_000),
    });
    const { order } = await placeOnlineOrder(token, 2, { couponCode: "SAVE20", discountBDT: 1900 });
    // 2 x ৳1000, 20% off, + ৳60 shipping.
    expect(order.totalBDT).toBe(1660);

    const tranId = await startPayment(token, order._id);
    expect(initSslcommerzPayment).toHaveBeenCalledWith(expect.objectContaining({ amountBDT: 1660 }));

    validateSslcommerzPayment.mockResolvedValue(validResult(tranId, { amount: "2060.00" }));
    const res = await request(app)
      .post(`${CALLBACK}/success`)
      .type("form")
      .send({ tran_id: tranId, val_id: "VAL123" });
    expect(redirectPath(res)).toBe("/checkout/payment/failed");
    expect((await OrderModel.findById(order._id))?.isPaid).toBe(false);
  });

  it("reports which providers are live without exposing any credential", async () => {
    const res = await request(app).get("/api/v1/payments/config");
    expect(res.status).toBe(200);
    expect(res.body.data.providers).toEqual({ sslcommerz: true });
  });
});

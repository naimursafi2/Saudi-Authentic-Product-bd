/**
 * The bKash gateway client is stubbed here: the test environment has no
 * `BKASH_*` credentials, so the real `config/bkash` module would refuse every
 * call with a 503. Mocking it also lets each test dictate exactly what bKash
 * "replies", which is the only way to exercise the fraud paths (a settled
 * amount that doesn't match the order, a transaction referencing someone
 * else's invoice, a replayed callback). Mock first, import the app after, so
 * the service picks up the stub.
 */
const createBkashPayment = jest.fn();
const executeBkashPayment = jest.fn();
const queryBkashPayment = jest.fn();

jest.mock("../../config/bkash", () => ({
  isBkashConfigured: true,
  createBkashPayment: (...args: unknown[]) => createBkashPayment(...args),
  executeBkashPayment: (...args: unknown[]) => executeBkashPayment(...args),
  queryBkashPayment: (...args: unknown[]) => queryBkashPayment(...args),
  resetBkashTokenCache: jest.fn(),
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

const shippingAddress = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane.doe@example.com",
  phone: "+8801812345678",
  fullAddress: "House 1, Road 2",
  district: "Dhaka",
  cityArea: "Gulshan",
};

/** Safe to call more than once per test — both slugs are uniquely indexed. */
let seedCounter = 0;
async function seedProduct() {
  seedCounter += 1;
  const category = await CategoryModel.findOneAndUpdate(
    { slug: "dates" },
    { $setOnInsert: { name: "Dates", slug: "dates" } },
    { upsert: true, new: true }
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

/** Places a real bKash order through the API so every downstream figure is server-computed. */
async function placeBkashOrder(token: string, quantity = 2) {
  const product = await seedProduct();
  const res = await request(app)
    .post("/api/v1/orders")
    .set(...authHeader(token))
    .send({
      items: [{ productId: product._id.toString(), variantId: product.variants[0]!._id!.toString(), quantity }],
      shippingAddress,
      deliveryMethod: "standard",
      paymentMethod: "bkash",
    });
  expect(res.status).toBe(201);
  return { product, order: res.body.data.order as { _id: string; orderNumber: string; totalBDT: number } };
}

function stubCreate(paymentID = "TR0011bkash01") {
  createBkashPayment.mockResolvedValue({
    paymentID,
    bkashURL: `https://sandbox.bkash.test/checkout/${paymentID}`,
    amount: "0.00",
    currency: "BDT",
    transactionStatus: "Initiated",
  });
}

/**
 * Backdates a payment's `createdAt` so the reconciliation sweep treats it as
 * stale — far less brittle than faking timers around an in-memory MongoDB.
 *
 * Goes through the raw driver on purpose: Mongoose marks a `timestamps: true`
 * schema's `createdAt` as immutable, so a normal `updateOne` would drop this
 * write silently and the sweep would simply never see the payment as old.
 */
async function agePayment(gatewayPaymentId: string, ageMs: number) {
  await PaymentModel.collection.updateOne(
    { gatewayPaymentId },
    { $set: { createdAt: new Date(Date.now() - ageMs) } }
  );
}

function completedResult(overrides: Record<string, unknown> = {}) {
  return {
    paymentID: "TR0011bkash01",
    trxID: "BKH7X2QK91",
    transactionStatus: "Completed",
    amount: "2060.00",
    currency: "BDT",
    merchantInvoiceNumber: undefined,
    ...overrides,
  };
}

describe("bKash payment integration", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("creates a payment for the server-computed order total, never a client-supplied amount", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order } = await placeBkashOrder(token);
    stubCreate();

    const res = await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(token))
      // A tampered amount in the body is simply not part of the contract —
      // there is no field for it to land in.
      .send({ orderId: order._id, amountBDT: 10, totalBDT: 10 });

    expect(res.status).toBe(201);
    expect(res.body.data.payment.amountBDT).toBe(order.totalBDT);
    expect(res.body.data.payment.bkashURL).toContain("https://sandbox.bkash.test/");
    expect(createBkashPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amountBDT: order.totalBDT, merchantInvoiceNumber: order.orderNumber })
    );

    // Nothing safe-listed leaks a credential or a gateway token.
    expect(JSON.stringify(res.body)).not.toMatch(/app_?key|app_?secret|id_token|password/i);
  });

  it("verifies a completed payment, marks the order paid and confirms it exactly once", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order, product } = await placeBkashOrder(token);
    stubCreate();

    await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(token))
      .send({ orderId: order._id });

    executeBkashPayment.mockResolvedValue(
      completedResult({ amount: String(order.totalBDT), merchantInvoiceNumber: order.orderNumber })
    );

    const res = await request(app)
      .post("/api/v1/payments/bkash/execute")
      .set(...authHeader(token))
      .send({ paymentID: "TR0011bkash01" });

    expect(res.status).toBe(200);
    expect(res.body.data.payment.status).toBe("paid");
    expect(res.body.data.payment.transactionId).toBe("BKH7X2QK91");
    expect(res.body.data.order.isPaid).toBe(true);
    expect(res.body.data.order.status).toBe("confirmed");

    // Stock was consumed once when the order was placed; payment verification
    // has no inventory side effect at all.
    const afterProduct = await ProductModel.findById(product._id);
    expect(afterProduct?.variants[0]?.stock).toBe(8);
  });

  it("is idempotent — a replayed callback neither re-confirms the order nor double-deducts stock", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order, product } = await placeBkashOrder(token);
    stubCreate();
    await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(token))
      .send({ orderId: order._id });

    executeBkashPayment.mockResolvedValue(
      completedResult({ amount: String(order.totalBDT), merchantInvoiceNumber: order.orderNumber })
    );

    const first = await request(app)
      .post("/api/v1/payments/bkash/execute")
      .set(...authHeader(token))
      .send({ paymentID: "TR0011bkash01" });
    const second = await request(app)
      .post("/api/v1/payments/bkash/execute")
      .set(...authHeader(token))
      .send({ paymentID: "TR0011bkash01" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data.payment.status).toBe("paid");

    // The replay never even reached the gateway a second time.
    expect(executeBkashPayment).toHaveBeenCalledTimes(1);

    const stored = await OrderModel.findById(order._id);
    expect(stored?.statusHistory.filter((entry) => entry.status === "confirmed")).toHaveLength(1);

    const payments = await PaymentModel.find({ order: order._id });
    expect(payments).toHaveLength(1);

    const afterProduct = await ProductModel.findById(product._id);
    expect(afterProduct?.variants[0]?.stock).toBe(8);
  });

  it("rejects a gateway transaction whose settled amount does not match the order total", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order } = await placeBkashOrder(token);
    stubCreate();
    await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(token))
      .send({ orderId: order._id });

    executeBkashPayment.mockResolvedValue(
      completedResult({ amount: "10.00", merchantInvoiceNumber: order.orderNumber })
    );
    queryBkashPayment.mockResolvedValue(
      completedResult({ amount: "10.00", merchantInvoiceNumber: order.orderNumber })
    );

    const res = await request(app)
      .post("/api/v1/payments/bkash/execute")
      .set(...authHeader(token))
      .send({ paymentID: "TR0011bkash01" });

    expect(res.status).toBe(400);
    // The customer is never told which check failed.
    expect(res.body.message).not.toMatch(/10\.00/);

    const stored = await OrderModel.findById(order._id);
    expect(stored?.isPaid).toBe(false);
    expect(stored?.status).toBe("pending");

    const payment = await PaymentModel.findOne({ gatewayPaymentId: "TR0011bkash01" });
    expect(payment?.status).toBe("failed");
    expect(payment?.failureReason).toMatch(/10/);
  });

  it("rejects a transaction that references a different order's invoice", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order } = await placeBkashOrder(token);
    stubCreate();
    await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(token))
      .send({ orderId: order._id });

    executeBkashPayment.mockResolvedValue(
      completedResult({ amount: String(order.totalBDT), merchantInvoiceNumber: "SAP-19700101-0001" })
    );
    queryBkashPayment.mockResolvedValue(
      completedResult({ amount: String(order.totalBDT), merchantInvoiceNumber: "SAP-19700101-0001" })
    );

    const res = await request(app)
      .post("/api/v1/payments/bkash/execute")
      .set(...authHeader(token))
      .send({ paymentID: "TR0011bkash01" });

    expect(res.status).toBe(400);
    const stored = await OrderModel.findById(order._id);
    expect(stored?.isPaid).toBe(false);
  });

  it("404s on a fabricated transaction id and on another customer's payment", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { token: otherToken } = await createAuthedUser({ role: "customer" });
    const { order } = await placeBkashOrder(token);
    stubCreate();
    await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(token))
      .send({ orderId: order._id });

    const fabricated = await request(app)
      .post("/api/v1/payments/bkash/execute")
      .set(...authHeader(token))
      .send({ paymentID: "TOTALLY-MADE-UP" });
    expect(fabricated.status).toBe(404);

    const foreign = await request(app)
      .post("/api/v1/payments/bkash/execute")
      .set(...authHeader(otherToken))
      .send({ paymentID: "TR0011bkash01" });
    expect(foreign.status).toBe(404);
    expect(executeBkashPayment).not.toHaveBeenCalled();
  });

  it("refuses to start a payment on someone else's order", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { token: otherToken } = await createAuthedUser({ role: "customer" });
    const { order } = await placeBkashOrder(token);
    stubCreate();

    const res = await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(otherToken))
      .send({ orderId: order._id });

    expect(res.status).toBe(403);
    expect(createBkashPayment).not.toHaveBeenCalled();
  });

  it("refuses a second payment on an already-paid order", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order } = await placeBkashOrder(token);
    stubCreate();
    await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(token))
      .send({ orderId: order._id });
    executeBkashPayment.mockResolvedValue(
      completedResult({ amount: String(order.totalBDT), merchantInvoiceNumber: order.orderNumber })
    );
    await request(app)
      .post("/api/v1/payments/bkash/execute")
      .set(...authHeader(token))
      .send({ paymentID: "TR0011bkash01" });

    const res = await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(token))
      .send({ orderId: order._id });

    expect(res.status).toBe(409);
  });

  it("reuses one gateway session across repeated Pay Now clicks instead of opening a chargeable second one", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order } = await placeBkashOrder(token);
    stubCreate();

    const first = await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(token))
      .send({ orderId: order._id });
    const second = await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(token))
      .send({ orderId: order._id });

    expect(second.status).toBe(201);
    expect(second.body.data.payment.gatewayPaymentId).toBe(first.body.data.payment.gatewayPaymentId);
    expect(createBkashPayment).toHaveBeenCalledTimes(1);
    expect(await PaymentModel.countDocuments({ order: order._id })).toBe(1);
  });

  it("cannot complete a payment the customer cancelled", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order } = await placeBkashOrder(token);
    stubCreate();
    await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(token))
      .send({ orderId: order._id });

    const cancelled = await request(app)
      .post("/api/v1/payments/bkash/cancel")
      .set(...authHeader(token))
      .send({ paymentID: "TR0011bkash01" });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.payment.status).toBe("cancelled");

    const res = await request(app)
      .post("/api/v1/payments/bkash/execute")
      .set(...authHeader(token))
      .send({ paymentID: "TR0011bkash01" });
    expect(res.status).toBe(400);
    expect(executeBkashPayment).not.toHaveBeenCalled();

    const stored = await OrderModel.findById(order._id);
    expect(stored?.isPaid).toBe(false);
  });

  it("gates the staff payment list on payments.view, and exposes no way to settle a payment by hand", async () => {
    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    const { token: employeeToken } = await createAuthedUser({ role: "employee" });
    const { token: managerToken } = await createAuthedUser({ role: "order_manager" });
    const { token: adminToken } = await createAuthedUser({ role: "admin" });

    expect((await request(app).get("/api/v1/payments").set(...authHeader(customerToken))).status).toBe(403);
    expect((await request(app).get("/api/v1/payments").set(...authHeader(employeeToken))).status).toBe(403);
    expect((await request(app).get("/api/v1/payments").set(...authHeader(managerToken))).status).toBe(200);
    expect((await request(app).get("/api/v1/payments").set(...authHeader(adminToken))).status).toBe(200);

    // Verification is automatic — no staff endpoint settles a payment, not
    // even for a Super Admin. The route simply does not exist.
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });
    const someId = "0123456789abcdef01234567";
    expect(
      (await request(app).post(`/api/v1/payments/${someId}/verify`).set(...authHeader(superToken))).status
    ).toBe(404);
  });

  it("automatically reconciles a payment whose customer never made it back to the callback", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order } = await placeBkashOrder(token);
    stubCreate();
    await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(token))
      .send({ orderId: order._id });

    // The customer paid on bKash but their browser died before the callback.
    await agePayment("TR0011bkash01", 20 * 60 * 1000);
    queryBkashPayment.mockResolvedValue(
      completedResult({ amount: String(order.totalBDT), merchantInvoiceNumber: order.orderNumber })
    );

    await runPaymentReconciliationTick();

    const payment = await PaymentModel.findOne({ gatewayPaymentId: "TR0011bkash01" });
    expect(payment?.status).toBe("paid");
    expect(payment?.transactionId).toBe("BKH7X2QK91");

    const stored = await OrderModel.findById(order._id);
    expect(stored?.isPaid).toBe(true);
    expect(stored?.status).toBe("confirmed");
    expect(stored?.statusHistory.filter((e) => e.status === "confirmed")).toHaveLength(1);
  });

  it("leaves a fresh unfinished payment alone, so the sweep never races the customer's own callback", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order } = await placeBkashOrder(token);
    stubCreate();
    await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(token))
      .send({ orderId: order._id });

    // Only a couple of minutes old — the customer is still on the bKash page.
    await runPaymentReconciliationTick();

    expect(queryBkashPayment).not.toHaveBeenCalled();
    expect((await PaymentModel.findOne({ gatewayPaymentId: "TR0011bkash01" }))?.status).toBe("initiated");
  });

  it("holds off failing a slow customer, then abandons the payment once it is past the checkout window", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order } = await placeBkashOrder(token);
    stubCreate();
    await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(token))
      .send({ orderId: order._id });

    // bKash still calls it Initiated: the customer may yet finish.
    queryBkashPayment.mockResolvedValue(completedResult({ transactionStatus: "Initiated", trxID: undefined }));

    await agePayment("TR0011bkash01", 20 * 60 * 1000);
    await runPaymentReconciliationTick();
    expect((await PaymentModel.findOne({ gatewayPaymentId: "TR0011bkash01" }))?.status).toBe("initiated");

    // Well past the bKash session window — now it is genuinely abandoned.
    await agePayment("TR0011bkash01", 50 * 60 * 1000);
    await runPaymentReconciliationTick();

    const payment = await PaymentModel.findOne({ gatewayPaymentId: "TR0011bkash01" });
    expect(payment?.status).toBe("failed");
    expect(payment?.failureReason).toMatch(/abandoned/i);
    expect((await OrderModel.findById(order._id))?.isPaid).toBe(false);
  });

  it("never settles an order from reconciliation when bKash's amount does not match", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order } = await placeBkashOrder(token);
    stubCreate();
    await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(token))
      .send({ orderId: order._id });

    await agePayment("TR0011bkash01", 20 * 60 * 1000);
    queryBkashPayment.mockResolvedValue(
      completedResult({ amount: "1.00", merchantInvoiceNumber: order.orderNumber })
    );

    await runPaymentReconciliationTick();

    expect((await PaymentModel.findOne({ gatewayPaymentId: "TR0011bkash01" }))?.status).toBe("failed");
    expect((await OrderModel.findById(order._id))?.isPaid).toBe(false);
  });

  it("keeps sweeping after one payment's gateway call fails", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { order: firstOrder } = await placeBkashOrder(token);
    stubCreate("TR-FIRST");
    await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(token))
      .send({ orderId: firstOrder._id });

    const { order: secondOrder } = await placeBkashOrder(token);
    stubCreate("TR-SECOND");
    await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(token))
      .send({ orderId: secondOrder._id });

    await agePayment("TR-FIRST", 20 * 60 * 1000);
    await agePayment("TR-SECOND", 20 * 60 * 1000);

    queryBkashPayment.mockImplementation((paymentID: string) => {
      if (paymentID === "TR-FIRST") return Promise.reject(new Error("gateway unreachable"));
      return Promise.resolve(
        completedResult({
          paymentID: "TR-SECOND",
          amount: String(secondOrder.totalBDT),
          merchantInvoiceNumber: secondOrder.orderNumber,
        })
      );
    });

    await runPaymentReconciliationTick();

    // The failure is contained: the first stays open for the next tick, the
    // second is still settled.
    expect((await PaymentModel.findOne({ gatewayPaymentId: "TR-FIRST" }))?.status).toBe("initiated");
    expect((await PaymentModel.findOne({ gatewayPaymentId: "TR-SECOND" }))?.status).toBe("paid");
    expect((await OrderModel.findById(secondOrder._id))?.isPaid).toBe(true);
  });

  it("exposes an order's payment to its owner but not to an unrelated customer", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { token: otherToken } = await createAuthedUser({ role: "customer" });
    const { order } = await placeBkashOrder(token);
    stubCreate();
    await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(token))
      .send({ orderId: order._id });

    const owner = await request(app)
      .get(`/api/v1/payments/order/${order._id}`)
      .set(...authHeader(token));
    expect(owner.status).toBe(200);
    expect(owner.body.data.payment.status).toBe("initiated");

    const stranger = await request(app)
      .get(`/api/v1/payments/order/${order._id}`)
      .set(...authHeader(otherToken));
    expect(stranger.status).toBe(403);
  });

  it("charges the discounted total when a coupon applies, not the undiscounted subtotal", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    await CouponModel.create({
      code: "SAVE20",
      discountType: "percentage",
      discountValue: 20,
      startsAt: new Date(Date.now() - 3600_000),
      expiresAt: new Date(Date.now() + 3600_000),
    });
    const product = await seedProduct();
    const created = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(token))
      .send({
        items: [
          { productId: product._id.toString(), variantId: product.variants[0]!._id!.toString(), quantity: 2 },
        ],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "bkash",
        // A discount the client would like to have. It is not part of the
        // order schema and is silently discarded.
        discountBDT: 1900,
        couponCode: "SAVE20",
      });
    const order = created.body.data.order;

    // 2 x ৳1000 subtotal, 20% off, plus ৳60 standard shipping.
    expect(order.subtotalBDT).toBe(2000);
    expect(order.discountBDT).toBe(400);
    expect(order.shippingFeeBDT).toBe(60);
    expect(order.totalBDT).toBe(1660);

    stubCreate();
    const res = await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(token))
      .send({ orderId: order._id });

    expect(res.body.data.payment.amountBDT).toBe(1660);
    expect(createBkashPayment).toHaveBeenCalledWith(expect.objectContaining({ amountBDT: 1660 }));
  });

  it("rejects a settlement for the pre-discount amount on a discounted order", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    await CouponModel.create({
      code: "SAVE20",
      discountType: "percentage",
      discountValue: 20,
      startsAt: new Date(Date.now() - 3600_000),
      expiresAt: new Date(Date.now() + 3600_000),
    });
    const product = await seedProduct();
    const created = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(token))
      .send({
        items: [
          { productId: product._id.toString(), variantId: product.variants[0]!._id!.toString(), quantity: 2 },
        ],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "bkash",
        couponCode: "SAVE20",
      });
    const order = created.body.data.order;
    stubCreate();
    await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(token))
      .send({ orderId: order._id });

    // The gateway reports the undiscounted figure — an over-payment is as
    // much a mismatch as an under-payment and must not settle the order.
    const overpaid = completedResult({ amount: "2060.00", merchantInvoiceNumber: order.orderNumber });
    executeBkashPayment.mockResolvedValue(overpaid);
    queryBkashPayment.mockResolvedValue(overpaid);

    const res = await request(app)
      .post("/api/v1/payments/bkash/execute")
      .set(...authHeader(token))
      .send({ paymentID: "TR0011bkash01" });

    expect(res.status).toBe(400);
    expect((await OrderModel.findById(order._id))?.isPaid).toBe(false);
  });

  it("charges the free-shipping total once the order clears the threshold", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const product = await seedProduct();
    const created = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(token))
      .send({
        items: [
          { productId: product._id.toString(), variantId: product.variants[0]!._id!.toString(), quantity: 6 },
        ],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "bkash",
      });
    const order = created.body.data.order;

    // 6 x ৳1000 clears the ৳5,000 free-standard-shipping threshold.
    expect(order.shippingFeeBDT).toBe(0);
    expect(order.totalBDT).toBe(6000);

    stubCreate();
    const res = await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(token))
      .send({ orderId: order._id });
    expect(res.body.data.payment.amountBDT).toBe(6000);
  });

  it("reports which providers are live without exposing any credential", async () => {
    const res = await request(app).get("/api/v1/payments/config");
    expect(res.status).toBe(200);
    expect(res.body.data.providers).toEqual({ bkash: true });
  });
});

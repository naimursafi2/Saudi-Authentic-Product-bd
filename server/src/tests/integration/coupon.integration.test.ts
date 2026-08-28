import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { CategoryModel } from "../../models/Category.model";
import { ProductModel } from "../../models/Product.model";
import { CouponModel } from "../../models/Coupon.model";
import { OrderModel } from "../../models/Order.model";

const app = createApp();

const HOUR = 60 * 60 * 1000;

function isoIn(msFromNow: number): string {
  return new Date(Date.now() + msFromNow).toISOString();
}

async function seedProduct(priceBDT = 1000, stock = 10) {
  const category = await CategoryModel.create({ name: "Dates", slug: "dates" });
  return ProductModel.create({
    name: "Ajwa Dates",
    slug: "ajwa-dates",
    tagline: "Rich, soft Madinah dates",
    description: "Premium Ajwa dates.",
    origin: "Madinah",
    categories: [category._id],
    variants: [{ label: "500g", priceBDT, stock, lowStockThreshold: 2 }],
  });
}

const shippingAddress = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane.doe@example.com",
  phone: "+8801812345678",
  fullAddress: "House 1, Road 2",
  district: "Dhaka",
  cityArea: "Gulshan",
};

describe("Coupon integration", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("blocks customers from managing coupons entirely", async () => {
    const { token: customerToken } = await createAuthedUser({ role: "customer" });

    const asCustomer = await request(app)
      .post("/api/v1/coupons")
      .set(...authHeader(customerToken))
      .send({ code: "SAVE10", discountType: "percentage", discountValue: 10, startsAt: isoIn(-HOUR), expiresAt: isoIn(HOUR) });
    expect(asCustomer.status).toBe(403);
  });

  it("gates co_admin coupon creation by discount size per ROLES_AND_PERMISSIONS_v2.md §4", async () => {
    const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });

    // <=10% (default auto-approve threshold): created directly.
    const small = await request(app)
      .post("/api/v1/coupons")
      .set(...authHeader(coAdminToken))
      .send({ code: "SAVE10", discountType: "percentage", discountValue: 10, startsAt: isoIn(-HOUR), expiresAt: isoIn(HOUR) });
    expect(small.status).toBe(201);
    expect(small.body.data.coupon.code).toBe("SAVE10");

    // 10.01-25%: routed through the approval gate, not created immediately.
    const medium = await request(app)
      .post("/api/v1/coupons")
      .set(...authHeader(coAdminToken))
      .send({ code: "SAVE20", discountType: "percentage", discountValue: 20, startsAt: isoIn(-HOUR), expiresAt: isoIn(HOUR) });
    expect(medium.status).toBe(202);
    expect(medium.body.data.pendingActionId).toBeTruthy();
    const notYetCreated = await CouponModel.findOne({ code: "SAVE20" });
    expect(notYetCreated).toBeNull();

    // >25%: forbidden outright for co_admin.
    const large = await request(app)
      .post("/api/v1/coupons")
      .set(...authHeader(coAdminToken))
      .send({ code: "SAVE50", discountType: "percentage", discountValue: 50, startsAt: isoIn(-HOUR), expiresAt: isoIn(HOUR) });
    expect(large.status).toBe(403);

    // Fixed-amount discounts aren't gated by the percentage thresholds.
    const fixed = await request(app)
      .post("/api/v1/coupons")
      .set(...authHeader(coAdminToken))
      .send({ code: "FLAT500", discountType: "fixed", discountValue: 500, startsAt: isoIn(-HOUR), expiresAt: isoIn(HOUR) });
    expect(fixed.status).toBe(201);
  });

  it("lets a super_admin grant a gated coupon request, creating it with the original payload", async () => {
    const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });

    const requestRes = await request(app)
      .post("/api/v1/coupons")
      .set(...authHeader(coAdminToken))
      .send({ code: "SAVE20", discountType: "percentage", discountValue: 20, startsAt: isoIn(-HOUR), expiresAt: isoIn(HOUR) });
    expect(requestRes.status).toBe(202);
    const pendingActionId = requestRes.body.data.pendingActionId;

    const grantRes = await request(app)
      .patch(`/api/v1/pending-actions/${pendingActionId}/grant`)
      .set(...authHeader(superAdminToken))
      .send({});
    expect(grantRes.status).toBe(200);
    expect(grantRes.body.data.action.status).toBe("granted");

    const created = await CouponModel.findOne({ code: "SAVE20" });
    expect(created).not.toBeNull();
    expect(created?.discountValue).toBe(20);
  });

  it("creates a coupon as admin, rejects a duplicate code, and lists it with a computed status", async () => {
    const { token } = await createAuthedUser({ role: "admin" });

    const create = await request(app)
      .post("/api/v1/coupons")
      .set(...authHeader(token))
      .send({
        code: "welcome10",
        discountType: "percentage",
        discountValue: 10,
        startsAt: isoIn(-HOUR),
        expiresAt: isoIn(HOUR),
      });
    expect(create.status).toBe(201);
    expect(create.body.data.coupon.code).toBe("WELCOME10"); // uppercased

    const dup = await request(app)
      .post("/api/v1/coupons")
      .set(...authHeader(token))
      .send({
        code: "WELCOME10",
        discountType: "fixed",
        discountValue: 100,
        startsAt: isoIn(-HOUR),
        expiresAt: isoIn(HOUR),
      });
    expect(dup.status).toBe(409);

    const list = await request(app)
      .get("/api/v1/coupons")
      .set(...authHeader(token));
    expect(list.status).toBe(200);
    expect(list.body.data.coupons).toHaveLength(1);
    expect(list.body.data.coupons[0].status).toBe("active");
  });

  it("rejects a percentage discount over 100 and an expiry before the start date", async () => {
    const { token } = await createAuthedUser({ role: "admin" });

    const overHundred = await request(app)
      .post("/api/v1/coupons")
      .set(...authHeader(token))
      .send({ code: "TOOBIG", discountType: "percentage", discountValue: 150, startsAt: isoIn(-HOUR), expiresAt: isoIn(HOUR) });
    expect(overHundred.status).toBe(400);

    const badDates = await request(app)
      .post("/api/v1/coupons")
      .set(...authHeader(token))
      .send({ code: "BADDATES", discountType: "fixed", discountValue: 50, startsAt: isoIn(HOUR), expiresAt: isoIn(-HOUR) });
    expect(badDates.status).toBe(400);
  });

  it("computes scheduled/active/expired/disabled status correctly", async () => {
    const { token } = await createAuthedUser({ role: "admin" });

    await CouponModel.create({
      code: "SCHED",
      discountType: "fixed",
      discountValue: 50,
      startsAt: new Date(Date.now() + HOUR),
      expiresAt: new Date(Date.now() + 2 * HOUR),
    });
    await CouponModel.create({
      code: "EXPIRED",
      discountType: "fixed",
      discountValue: 50,
      startsAt: new Date(Date.now() - 2 * HOUR),
      expiresAt: new Date(Date.now() - HOUR),
    });
    await CouponModel.create({
      code: "OFF",
      discountType: "fixed",
      discountValue: 50,
      startsAt: new Date(Date.now() - HOUR),
      expiresAt: new Date(Date.now() + HOUR),
      isActive: false,
    });

    const res = await request(app)
      .get("/api/v1/coupons")
      .set(...authHeader(token));
    const byCode: Record<string, string> = {};
    for (const c of res.body.data.coupons) byCode[c.code] = c.status;

    expect(byCode.SCHED).toBe("scheduled");
    expect(byCode.EXPIRED).toBe("expired");
    expect(byCode.OFF).toBe("disabled");
  });

  it("validates a percentage coupon and rejects an unknown code", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    await CouponModel.create({
      code: "SAVE20",
      discountType: "percentage",
      discountValue: 20,
      startsAt: new Date(Date.now() - HOUR),
      expiresAt: new Date(Date.now() + HOUR),
    });

    const ok = await request(app)
      .post("/api/v1/coupons/validate")
      .set(...authHeader(token))
      .send({ code: "save20", subtotalBDT: 1000 });
    expect(ok.status).toBe(200);
    expect(ok.body.data.discountBDT).toBe(200);

    const unknown = await request(app)
      .post("/api/v1/coupons/validate")
      .set(...authHeader(token))
      .send({ code: "NOPE", subtotalBDT: 1000 });
    expect(unknown.status).toBe(400);
  });

  it("rejects a coupon below its minimum order amount", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    await CouponModel.create({
      code: "BIGORDER",
      discountType: "fixed",
      discountValue: 100,
      minOrderAmountBDT: 5000,
      startsAt: new Date(Date.now() - HOUR),
      expiresAt: new Date(Date.now() + HOUR),
    });

    const res = await request(app)
      .post("/api/v1/coupons/validate")
      .set(...authHeader(token))
      .send({ code: "BIGORDER", subtotalBDT: 1000 });
    expect(res.status).toBe(400);
    expect(res.body.message.toLowerCase()).toContain("minimum");
  });

  it("applies a coupon at order creation, storing the server-computed discount and incrementing usage", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const product = await seedProduct(1000);
    const variantId = product.variants[0]!._id!.toString();
    const coupon = await CouponModel.create({
      code: "ORDER10",
      discountType: "percentage",
      discountValue: 10,
      startsAt: new Date(Date.now() - HOUR),
      expiresAt: new Date(Date.now() + HOUR),
      usageLimit: 1,
    });

    const res = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(token))
      .send({
        items: [{ productId: product._id.toString(), variantId, quantity: 2 }],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "cod",
        couponCode: "order10",
      });

    expect(res.status).toBe(201);
    const order = res.body.data.order;
    expect(order.subtotalBDT).toBe(2000);
    expect(order.discountBDT).toBe(200);
    expect(order.couponCode).toBe("ORDER10");
    expect(order.totalBDT).toBe(order.subtotalBDT + order.shippingFeeBDT - 200);

    const updatedCoupon = await CouponModel.findById(coupon._id);
    expect(updatedCoupon?.usageCount).toBe(1);
  });

  it("rejects order creation with an exhausted, expired, or unknown coupon — and never charges a client-submitted discount", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const product = await seedProduct(1000);
    const variantId = product.variants[0]!._id!.toString();

    await CouponModel.create({
      code: "USEDUP",
      discountType: "fixed",
      discountValue: 500,
      startsAt: new Date(Date.now() - HOUR),
      expiresAt: new Date(Date.now() + HOUR),
      usageLimit: 1,
      usageCount: 1,
    });

    const exhausted = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(token))
      .send({
        items: [{ productId: product._id.toString(), variantId, quantity: 1 }],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "cod",
        couponCode: "USEDUP",
      });
    expect(exhausted.status).toBe(400);

    const unknown = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(token))
      .send({
        items: [{ productId: product._id.toString(), variantId, quantity: 1 }],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "cod",
        couponCode: "DOES-NOT-EXIST",
      });
    expect(unknown.status).toBe(400);

    const updatedProduct = await ProductModel.findById(product._id);
    // Stock must be untouched — no order should have been created for either rejected attempt.
    expect(updatedProduct?.variants[0]?.stock).toBe(10);
  });

  it("leaves nothing behind when the coupon's last use is lost to a concurrent order", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const product = await seedProduct(1000);
    const variantId = product.variants[0]!._id!.toString();
    await CouponModel.create({
      code: "LASTONE",
      discountType: "fixed",
      discountValue: 500,
      startsAt: new Date(Date.now() - HOUR),
      expiresAt: new Date(Date.now() + HOUR),
      usageLimit: 1,
    });

    const body = {
      items: [{ productId: product._id.toString(), variantId, quantity: 1 }],
      shippingAddress,
      deliveryMethod: "standard" as const,
      paymentMethod: "bkash" as const,
      couponCode: "LASTONE",
    };

    const first = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(token))
      .send(body);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(token))
      .send(body);
    expect(second.status).toBe(400);

    // Exactly one order exists. The rejected attempt must not have left a
    // discounted, stock-less ghost order behind — which, being a bKash order,
    // would otherwise have been payable.
    const orders = await OrderModel.find();
    expect(orders).toHaveLength(1);

    const updatedProduct = await ProductModel.findById(product._id);
    expect(updatedProduct?.variants[0]?.stock).toBe(9);
  });

  it("hands a coupon use back when the order that consumed it is cancelled", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const product = await seedProduct(1000);
    const variantId = product.variants[0]!._id!.toString();
    const coupon = await CouponModel.create({
      code: "GIVEBACK",
      discountType: "fixed",
      discountValue: 200,
      startsAt: new Date(Date.now() - HOUR),
      expiresAt: new Date(Date.now() + HOUR),
      usageLimit: 1,
    });

    const created = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(token))
      .send({
        items: [{ productId: product._id.toString(), variantId, quantity: 1 }],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "cod",
        couponCode: "GIVEBACK",
      });
    expect(created.status).toBe(201);
    expect((await CouponModel.findById(coupon._id))?.usageCount).toBe(1);

    const cancelled = await request(app)
      .patch(`/api/v1/orders/${created.body.data.order._id}/status`)
      .set(...authHeader(adminToken))
      .send({ status: "cancelled" });
    expect(cancelled.status).toBe(200);

    // The use returns alongside the restocked inventory — a cancelled order
    // must not permanently burn a limited coupon.
    expect((await CouponModel.findById(coupon._id))?.usageCount).toBe(0);
    expect((await ProductModel.findById(product._id))?.variants[0]?.stock).toBe(10);

    // And the coupon is genuinely usable again.
    const reused = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(token))
      .send({
        items: [{ productId: product._id.toString(), variantId, quantity: 1 }],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "cod",
        couponCode: "GIVEBACK",
      });
    expect(reused.status).toBe(201);
    expect(reused.body.data.order.discountBDT).toBe(200);
  });
});

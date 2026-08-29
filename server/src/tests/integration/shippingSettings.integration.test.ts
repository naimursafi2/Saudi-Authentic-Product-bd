import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { CategoryModel } from "../../models/Category.model";
import { ProductModel } from "../../models/Product.model";
import { ShippingSettingsModel, resetCachedShippingRates } from "../../models/ShippingSettings.model";
import { AuditLogModel } from "../../models/AuditLog.model";

const app = createApp();

let seedCounter = 0;
async function seedProduct(priceBDT = 1000) {
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
    variants: [{ label: "500g", priceBDT, stock: 50, lowStockThreshold: 2 }],
  });
}

function addressIn(district: string) {
  return {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane.doe@example.com",
    phone: "+8801812345678",
    fullAddress: "House 1, Road 2",
    district,
    cityArea: "Somewhere",
  };
}

async function placeOrder(
  token: string,
  opts: { district: string; quantity?: number; deliveryMethod?: "standard" | "express"; priceBDT?: number }
) {
  const product = await seedProduct(opts.priceBDT ?? 1000);
  const res = await request(app)
    .post("/api/v1/orders")
    .set(...authHeader(token))
    .send({
      items: [
        {
          productId: product._id.toString(),
          variantId: product.variants[0]!._id!.toString(),
          quantity: opts.quantity ?? 1,
        },
      ],
      shippingAddress: addressIn(opts.district),
      deliveryMethod: opts.deliveryMethod ?? "standard",
      paymentMethod: "cod",
    });
  expect(res.status).toBe(201);
  return res.body.data.order as {
    _id: string;
    shippingFeeBDT: number;
    subtotalBDT: number;
    totalBDT: number;
  };
}

describe("Dynamic shipping settings", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
    // The synchronous rate snapshot outlives the database wipe.
    resetCachedShippingRates();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("serves the defaults publicly, creating the singleton on first read", async () => {
    const res = await request(app).get("/api/v1/shipping-settings");

    expect(res.status).toBe(200);
    expect(res.body.data.settings).toMatchObject({
      insideDhakaChargeBDT: 60,
      outsideDhakaChargeBDT: 60,
      expressSurchargeBDT: 60,
      freeShippingEnabled: true,
      freeShippingMinOrderBDT: 5000,
      freeShippingAppliesToExpress: false,
    });
    expect(await ShippingSettingsModel.countDocuments()).toBe(1);
  });

  it("gates editing on settings.manage and leaves rates untouched when refused", async () => {
    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
    const { token: managerToken } = await createAuthedUser({ role: "order_manager" });
    const { token: adminToken } = await createAuthedUser({ role: "admin" });

    for (const token of [customerToken, coAdminToken, managerToken]) {
      const res = await request(app)
        .patch("/api/v1/shipping-settings")
        .set(...authHeader(token))
        .send({ insideDhakaChargeBDT: 0 });
      expect(res.status).toBe(403);
    }
    expect((await request(app).patch("/api/v1/shipping-settings").send({ insideDhakaChargeBDT: 0 })).status).toBe(401);

    const allowed = await request(app)
      .patch("/api/v1/shipping-settings")
      .set(...authHeader(adminToken))
      .send({ insideDhakaChargeBDT: 45 });
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.settings.insideDhakaChargeBDT).toBe(45);
  });

  it("charges the edited zone rates on a real order, and the client cannot override them", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { token: adminToken } = await createAuthedUser({ role: "admin" });

    await request(app)
      .patch("/api/v1/shipping-settings")
      .set(...authHeader(adminToken))
      .send({ insideDhakaChargeBDT: 40, outsideDhakaChargeBDT: 150 });

    const inside = await placeOrder(token, { district: "Dhaka" });
    expect(inside.shippingFeeBDT).toBe(40);
    expect(inside.totalBDT).toBe(inside.subtotalBDT + 40);

    const outside = await placeOrder(token, { district: "Sylhet" });
    expect(outside.shippingFeeBDT).toBe(150);

    // A client-supplied shipping figure is not part of the order schema and is
    // discarded — the server's own rate is what gets charged.
    const product = await seedProduct();
    const tampered = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(token))
      .send({
        items: [
          { productId: product._id.toString(), variantId: product.variants[0]!._id!.toString(), quantity: 1 },
        ],
        shippingAddress: addressIn("Sylhet"),
        deliveryMethod: "standard",
        paymentMethod: "cod",
        shippingFeeBDT: 0,
        totalBDT: 1,
      });
    expect(tampered.status).toBe(201);
    expect(tampered.body.data.order.shippingFeeBDT).toBe(150);
    expect(tampered.body.data.order.totalBDT).toBe(1150);
  });

  it("applies the express surcharge on top of the order's zone rate", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { token: adminToken } = await createAuthedUser({ role: "admin" });

    await request(app)
      .patch("/api/v1/shipping-settings")
      .set(...authHeader(adminToken))
      .send({ insideDhakaChargeBDT: 40, outsideDhakaChargeBDT: 150, expressSurchargeBDT: 100 });

    expect((await placeOrder(token, { district: "Dhaka", deliveryMethod: "express" })).shippingFeeBDT).toBe(140);
    expect((await placeOrder(token, { district: "Barishal", deliveryMethod: "express" })).shippingFeeBDT).toBe(250);
  });

  it("honours the free-shipping switch and threshold on a real order", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { token: adminToken } = await createAuthedUser({ role: "admin" });

    // Threshold lowered — a ৳2,000 basket now ships free.
    await request(app)
      .patch("/api/v1/shipping-settings")
      .set(...authHeader(adminToken))
      .send({ freeShippingMinOrderBDT: 2000 });
    expect((await placeOrder(token, { district: "Dhaka", quantity: 2 })).shippingFeeBDT).toBe(0);

    // Switched off entirely — the same basket is charged again.
    await request(app)
      .patch("/api/v1/shipping-settings")
      .set(...authHeader(adminToken))
      .send({ freeShippingEnabled: false });
    expect((await placeOrder(token, { district: "Dhaka", quantity: 2 })).shippingFeeBDT).toBe(60);
  });

  it("does not reset the other rates when only one field is patched", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });

    await request(app)
      .patch("/api/v1/shipping-settings")
      .set(...authHeader(adminToken))
      .send({ insideDhakaChargeBDT: 40, outsideDhakaChargeBDT: 150, freeShippingMinOrderBDT: 3000 });

    const res = await request(app)
      .patch("/api/v1/shipping-settings")
      .set(...authHeader(adminToken))
      .send({ expressSurchargeBDT: 90 });

    expect(res.body.data.settings).toMatchObject({
      insideDhakaChargeBDT: 40,
      outsideDhakaChargeBDT: 150,
      freeShippingMinOrderBDT: 3000,
      expressSurchargeBDT: 90,
    });
  });

  it("rejects a nonsensical rate and records every accepted change in the audit trail", async () => {
    const { token: adminToken, user } = await createAuthedUser({ role: "admin" });

    expect(
      (
        await request(app)
          .patch("/api/v1/shipping-settings")
          .set(...authHeader(adminToken))
          .send({ insideDhakaChargeBDT: -10 })
      ).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .patch("/api/v1/shipping-settings")
          .set(...authHeader(adminToken))
          .send({ standardDeliveryDays: 0 })
      ).status
    ).toBe(400);
    expect(
      (await request(app).patch("/api/v1/shipping-settings").set(...authHeader(adminToken)).send({})).status
    ).toBe(400);

    await request(app)
      .patch("/api/v1/shipping-settings")
      .set(...authHeader(adminToken))
      .send({ insideDhakaChargeBDT: 75 });

    const log = await AuditLogModel.findOne({ action: "shippingSettings.update" });
    expect(log).not.toBeNull();
    expect(log?.actor.toString()).toBe(user._id.toString());
    expect((log?.oldValue as { insideDhakaChargeBDT: number }).insideDhakaChargeBDT).toBe(60);
    expect((log?.newValue as { insideDhakaChargeBDT: number }).insideDhakaChargeBDT).toBe(75);
  });

  it("quotes the configured delivery estimate on the order", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { token: adminToken } = await createAuthedUser({ role: "admin" });

    await request(app)
      .patch("/api/v1/shipping-settings")
      .set(...authHeader(adminToken))
      .send({ standardDeliveryDays: 9 });

    const order = await placeOrder(token, { district: "Dhaka" });
    const detail = await request(app)
      .get(`/api/v1/orders/${order._id}`)
      .set(...authHeader(token));

    const placed = new Date(detail.body.data.order.createdAt);
    const estimated = new Date(detail.body.data.order.estimatedDeliveryDate);
    const days = Math.round((estimated.getTime() - placed.getTime()) / (24 * 60 * 60 * 1000));
    expect(days).toBe(9);
  });
});

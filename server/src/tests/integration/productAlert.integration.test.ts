import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { CategoryModel } from "../../models/Category.model";
import { ProductModel } from "../../models/Product.model";
import { ProductAlertModel } from "../../models/ProductAlert.model";

jest.mock("../../services/email.service", () => ({
  ...jest.requireActual("../../services/email.service"),
  sendPriceDropAlertEmail: jest.fn().mockResolvedValue(undefined),
  sendBackInStockAlertEmail: jest.fn().mockResolvedValue(undefined),
}));

const app = createApp();

async function seedProduct(overrides: { stock?: number; priceBDT?: number } = {}) {
  const suffix = Math.random().toString(36).slice(2, 8);
  const category = await CategoryModel.create({ name: "Dates", slug: `dates-${suffix}` });
  return ProductModel.create({
    name: "Ajwa Dates",
    slug: `ajwa-dates-${suffix}`,
    tagline: "Rich, soft Madinah dates",
    description: "Premium Ajwa dates.",
    origin: "Madinah",
    categories: [category._id],
    variants: [
      {
        label: "500g",
        priceBDT: overrides.priceBDT ?? 1000,
        stock: overrides.stock ?? 5,
        lowStockThreshold: 2,
      },
    ],
  });
}

describe("Product alerts (Price Drop / Back in Stock)", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("subscribes to a back-in-stock alert only while the variant is out of stock", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const outOfStock = await seedProduct({ stock: 0 });
    const inStock = await seedProduct({ stock: 5 });

    const ok = await request(app)
      .post("/api/v1/product-alerts")
      .set(...authHeader(token))
      .send({ productId: outOfStock._id.toString(), type: "back_in_stock" });
    expect(ok.status).toBe(201);

    const rejected = await request(app)
      .post("/api/v1/product-alerts")
      .set(...authHeader(token))
      .send({ productId: inStock._id.toString(), type: "back_in_stock" });
    expect(rejected.status).toBe(400);
  });

  it("captures the current price as the reference for a price-drop alert", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const product = await seedProduct({ priceBDT: 1000 });

    const res = await request(app)
      .post("/api/v1/product-alerts")
      .set(...authHeader(token))
      .send({ productId: product._id.toString(), type: "price_drop" });
    expect(res.status).toBe(201);
    expect(res.body.data.alert.referencePriceBDT).toBe(1000);
  });

  it("lists and removes the caller's own alerts, scoped away from other customers", async () => {
    const { token: mine } = await createAuthedUser({ role: "customer" });
    const { token: theirs } = await createAuthedUser({ role: "customer" });
    const product = await seedProduct({ stock: 0 });

    const created = await request(app)
      .post("/api/v1/product-alerts")
      .set(...authHeader(mine))
      .send({ productId: product._id.toString(), type: "back_in_stock" });
    const alertId = created.body.data.alert._id;

    const otherList = await request(app).get("/api/v1/product-alerts/mine").set(...authHeader(theirs));
    expect(otherList.body.data.alerts).toHaveLength(0);

    const myList = await request(app).get("/api/v1/product-alerts/mine").set(...authHeader(mine));
    expect(myList.body.data.alerts).toHaveLength(1);

    // Another customer can't delete someone else's alert.
    const forbiddenRemove = await request(app)
      .delete(`/api/v1/product-alerts/${alertId}`)
      .set(...authHeader(theirs));
    expect(forbiddenRemove.status).toBe(404);

    const remove = await request(app).delete(`/api/v1/product-alerts/${alertId}`).set(...authHeader(mine));
    expect(remove.status).toBe(200);
    expect(await ProductAlertModel.findById(alertId)).toBeNull();
  });

  it("deactivates a back-in-stock alert once stock is restocked above zero", async () => {
    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
    const product = await seedProduct({ stock: 0 });

    await request(app)
      .post("/api/v1/product-alerts")
      .set(...authHeader(customerToken))
      .send({ productId: product._id.toString(), type: "back_in_stock" });

    const variantId = product.variants[0]!._id!.toString();
    const restock = await request(app)
      .post("/api/v1/inventory/adjust")
      .set(...authHeader(superAdminToken))
      .send({ productId: product._id.toString(), variantId, delta: 10 });
    expect(restock.status).toBe(200);

    const list = await request(app).get("/api/v1/product-alerts/mine").set(...authHeader(customerToken));
    expect(list.body.data.alerts).toHaveLength(0);

    const alert = await ProductAlertModel.findOne({ product: product._id, type: "back_in_stock" });
    expect(alert?.isActive).toBe(false);
    expect(alert?.notifiedAt).toBeTruthy();
  });

  it("deactivates a price-drop alert once the variant's price is edited lower", async () => {
    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
    const product = await seedProduct({ priceBDT: 1000 });

    await request(app)
      .post("/api/v1/product-alerts")
      .set(...authHeader(customerToken))
      .send({ productId: product._id.toString(), type: "price_drop" });

    const variant = product.variants[0]!;
    const update = await request(app)
      .patch(`/api/v1/products/${product._id.toString()}`)
      .set(...authHeader(superAdminToken))
      .field("name", product.name)
      .field("tagline", product.tagline)
      .field("description", product.description)
      .field("origin", product.origin)
      .field("categories", JSON.stringify(product.categories.map((c) => c.toString())))
      .field(
        "variants",
        JSON.stringify([{ id: variant._id!.toString(), label: variant.label, priceBDT: 800, stock: variant.stock }])
      );
    expect(update.status).toBe(200);

    const list = await request(app).get("/api/v1/product-alerts/mine").set(...authHeader(customerToken));
    expect(list.body.data.alerts).toHaveLength(0);

    const alert = await ProductAlertModel.findOne({ product: product._id, type: "price_drop" });
    expect(alert?.isActive).toBe(false);
  });

  it("does not fire a price-drop alert when the price is raised or unchanged", async () => {
    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
    const product = await seedProduct({ priceBDT: 1000 });

    await request(app)
      .post("/api/v1/product-alerts")
      .set(...authHeader(customerToken))
      .send({ productId: product._id.toString(), type: "price_drop" });

    const variant = product.variants[0]!;
    await request(app)
      .patch(`/api/v1/products/${product._id.toString()}`)
      .set(...authHeader(superAdminToken))
      .field("name", product.name)
      .field("tagline", product.tagline)
      .field("description", product.description)
      .field("origin", product.origin)
      .field("categories", JSON.stringify(product.categories.map((c) => c.toString())))
      .field(
        "variants",
        JSON.stringify([{ id: variant._id!.toString(), label: variant.label, priceBDT: 1200, stock: variant.stock }])
      );

    const alert = await ProductAlertModel.findOne({ product: product._id, type: "price_drop" });
    expect(alert?.isActive).toBe(true);
  });
});

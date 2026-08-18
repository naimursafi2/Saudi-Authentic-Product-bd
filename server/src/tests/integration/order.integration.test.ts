import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { CategoryModel } from "../../models/Category.model";
import { ProductModel } from "../../models/Product.model";

const app = createApp();

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

describe("Order integration (create/list/track against a real DB)", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  const shippingAddress = {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane.doe@example.com",
    phone: "+8801812345678",
    fullAddress: "House 1, Road 2",
    district: "Dhaka",
    cityArea: "Gulshan",
  };

  it("creates an order for a logged-in customer, decrements stock, and lists it under /orders/mine", async () => {
    const { token, user } = await createAuthedUser({ role: "customer" });
    const { product } = await seedProduct();
    const variantId = product.variants[0]!._id!.toString();

    const createRes = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(token))
      .send({
        items: [{ productId: product._id.toString(), variantId, quantity: 2 }],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "cod",
      });

    expect(createRes.status).toBe(201);
    const order = createRes.body.data.order;
    expect(order.subtotalBDT).toBe(2000);
    expect(order.status).toBe("pending");
    expect(order.orderNumber).toMatch(/^SAP-\d{8}-\d{4}$/);

    const updatedProduct = await ProductModel.findById(product._id);
    expect(updatedProduct?.variants[0]?.stock).toBe(3);

    const mineRes = await request(app)
      .get("/api/v1/orders/mine")
      .set(...authHeader(token));
    expect(mineRes.status).toBe(200);
    expect(mineRes.body.data.orders).toHaveLength(1);
    expect(mineRes.body.data.orders[0].customer).toBe(user._id.toString());
  });

  it("rejects an order that exceeds available stock", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { product } = await seedProduct();
    const variantId = product.variants[0]!._id!.toString();

    const res = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(token))
      .send({
        items: [{ productId: product._id.toString(), variantId, quantity: 99 }],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "cod",
      });

    expect(res.status).toBe(400);
  });

  it("supports public order tracking by orderNumber + email, and 404s on a mismatch", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const { product } = await seedProduct();
    const variantId = product.variants[0]!._id!.toString();

    const createRes = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(token))
      .send({
        items: [{ productId: product._id.toString(), variantId, quantity: 1 }],
        shippingAddress,
        deliveryMethod: "express",
        paymentMethod: "bkash",
      });
    const orderNumber = createRes.body.data.order.orderNumber as string;

    const found = await request(app)
      .get("/api/v1/orders/track")
      .query({ orderNumber, email: shippingAddress.email });
    expect(found.status).toBe(200);
    expect(found.body.data.order.orderNumber).toBe(orderNumber);

    const wrongEmail = await request(app)
      .get("/api/v1/orders/track")
      .query({ orderNumber, email: "someone-else@example.com" });
    expect(wrongEmail.status).toBe(404);
  });

  it("prevents one customer from listing another customer's orders as their own", async () => {
    const { token: buyerToken } = await createAuthedUser({ role: "customer", email: "buyer@example.com" });
    const { token: otherToken } = await createAuthedUser({ role: "customer", email: "other@example.com" });
    const { product } = await seedProduct();
    const variantId = product.variants[0]!._id!.toString();

    await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(buyerToken))
      .send({
        items: [{ productId: product._id.toString(), variantId, quantity: 1 }],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "cod",
      });

    const otherMine = await request(app)
      .get("/api/v1/orders/mine")
      .set(...authHeader(otherToken));
    expect(otherMine.status).toBe(200);
    expect(otherMine.body.data.orders).toHaveLength(0);
  });
});

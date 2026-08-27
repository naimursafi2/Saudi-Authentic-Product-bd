/**
 * Product Reviews integration tests — verified-purchase gate and photo
 * uploads.
 *
 * Cloudinary is stubbed rather than configured — same reasoning as
 * heroSlide.integration.test.ts: uploads are guarded by
 * `isCloudinaryConfigured`, so the real module would reject every review
 * photo with a 503 in the test environment. Mock first, import the app
 * after, so the service picks up the stub.
 */
const uploadBufferToCloudinary = jest
  .fn()
  .mockResolvedValue({ url: "https://cdn.test/review.jpg", publicId: "reviews/photo" });

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
import { OrderModel, type IOrder } from "../../models/Order.model";

const app = createApp();
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

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
  const category = await CategoryModel.create({ name: "Dates", slug: `dates-${Date.now()}` });
  return ProductModel.create({
    name: "Ajwa Dates",
    slug: `ajwa-dates-${Date.now()}`,
    tagline: "Rich, soft Madinah dates",
    description: "Premium Ajwa dates.",
    origin: "Madinah",
    categories: [category._id],
    variants: [{ label: "500g", priceBDT: 1000, stock: 5, lowStockThreshold: 2 }],
  });
}

/** A delivered order for `customerId` containing `productId` — the "verified purchase" fixture. */
async function seedDeliveredOrder(customerId: string, productId: string, status: IOrder["status"] = "delivered") {
  return OrderModel.create({
    orderNumber: `SAP-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
    customer: customerId,
    items: [
      {
        product: productId,
        productName: "Ajwa Dates",
        variantId: "v1",
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

describe("Product Reviews — verified purchase gate and photo uploads", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
    uploadBufferToCloudinary.mockClear();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("rejects a review from a customer who never purchased the product", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const product = await seedProduct();

    const res = await request(app)
      .post(`/api/v1/reviews/product/${product._id.toString()}`)
      .set(...authHeader(token))
      .send({ rating: 5, comment: "Never bought this but leaving a review anyway." });

    expect(res.status).toBe(403);
  });

  it("rejects a review from a customer whose order for the product hasn't been delivered yet", async () => {
    const { token, user } = await createAuthedUser({ role: "customer" });
    const product = await seedProduct();
    await seedDeliveredOrder(user._id.toString(), product._id.toString(), "processing");

    const res = await request(app)
      .post(`/api/v1/reviews/product/${product._id.toString()}`)
      .set(...authHeader(token))
      .send({ rating: 5, comment: "Still waiting for delivery." });

    expect(res.status).toBe(403);
  });

  it("submits a review with photos and uploads each one, marked as a verified purchase", async () => {
    const { token, user } = await createAuthedUser({ role: "customer" });
    const product = await seedProduct();
    await seedDeliveredOrder(user._id.toString(), product._id.toString());

    const res = await request(app)
      .post(`/api/v1/reviews/product/${product._id.toString()}`)
      .set(...authHeader(token))
      .field("rating", "5")
      .field("comment", "Absolutely delicious dates.")
      .attach("images", PIXEL, "photo1.png")
      .attach("images", PIXEL, "photo2.png");

    expect(res.status).toBe(201);
    expect(res.body.data.review.images).toHaveLength(2);
    expect(res.body.data.review.isVerifiedPurchase).toBe(true);
    expect(uploadBufferToCloudinary).toHaveBeenCalledTimes(2);
  });

  it("still submits a plain JSON review with no photos", async () => {
    const { token, user } = await createAuthedUser({ role: "customer" });
    const product = await seedProduct();
    await seedDeliveredOrder(user._id.toString(), product._id.toString());

    const res = await request(app)
      .post(`/api/v1/reviews/product/${product._id.toString()}`)
      .set(...authHeader(token))
      .send({ rating: 4, comment: "Good quality." });

    expect(res.status).toBe(201);
    expect(res.body.data.review.images).toHaveLength(0);
    expect(uploadBufferToCloudinary).not.toHaveBeenCalled();
  });

  it("still lets an admin delete a review, and it stops appearing in the public list", async () => {
    const { token, user } = await createAuthedUser({ role: "customer" });
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const product = await seedProduct();
    await seedDeliveredOrder(user._id.toString(), product._id.toString());

    const created = await request(app)
      .post(`/api/v1/reviews/product/${product._id.toString()}`)
      .set(...authHeader(token))
      .send({ rating: 3, comment: "It was okay." });
    const reviewId = created.body.data.review._id;

    const del = await request(app).delete(`/api/v1/reviews/${reviewId}`).set(...authHeader(adminToken));
    expect(del.status).toBe(200);

    const publicList = await request(app).get(`/api/v1/reviews/product/${product._id.toString()}`);
    expect(publicList.body.data.reviews).toHaveLength(0);
  });

  it("lets an admin hide a review without deleting it, and unhide it again", async () => {
    const { token, user } = await createAuthedUser({ role: "customer" });
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const product = await seedProduct();
    await seedDeliveredOrder(user._id.toString(), product._id.toString());

    const created = await request(app)
      .post(`/api/v1/reviews/product/${product._id.toString()}`)
      .set(...authHeader(token))
      .send({ rating: 2, comment: "Not great, unfortunately." });
    const reviewId = created.body.data.review._id;

    const forbidden = await request(app)
      .patch(`/api/v1/reviews/${reviewId}/visibility`)
      .set(...authHeader(token))
      .send({ isApproved: false });
    expect(forbidden.status).toBe(403);

    const hide = await request(app)
      .patch(`/api/v1/reviews/${reviewId}/visibility`)
      .set(...authHeader(adminToken))
      .send({ isApproved: false });
    expect(hide.status).toBe(200);

    const hiddenFromPublic = await request(app).get(`/api/v1/reviews/product/${product._id.toString()}`);
    expect(hiddenFromPublic.body.data.reviews).toHaveLength(0);

    const stillInAdminList = await request(app).get("/api/v1/reviews").set(...authHeader(adminToken));
    expect(stillInAdminList.body.data.reviews).toHaveLength(1);
    expect(stillInAdminList.body.data.reviews[0].isApproved).toBe(false);

    const unhide = await request(app)
      .patch(`/api/v1/reviews/${reviewId}/visibility`)
      .set(...authHeader(adminToken))
      .send({ isApproved: true });
    expect(unhide.status).toBe(200);

    const backInPublic = await request(app).get(`/api/v1/reviews/product/${product._id.toString()}`);
    expect(backInPublic.body.data.reviews).toHaveLength(1);
  });
});

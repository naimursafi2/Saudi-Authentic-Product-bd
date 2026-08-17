import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";

const app = createApp();

describe("Catalog integration (categories/products against a real DB)", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("rejects category creation from an unauthenticated request and from a customer", async () => {
    const anon = await request(app).post("/api/v1/categories").field("name", "Dates");
    expect(anon.status).toBe(401);

    const { token } = await createAuthedUser({ role: "customer" });
    const asCustomer = await request(app)
      .post("/api/v1/categories")
      .set(...authHeader(token))
      .field("name", "Dates");
    expect(asCustomer.status).toBe(403);
  });

  it("lets an admin create a category and a product, and serves both publicly", async () => {
    const { token } = await createAuthedUser({ role: "admin", email: "admin@example.com" });

    const categoryRes = await request(app)
      .post("/api/v1/categories")
      .set(...authHeader(token))
      .field("name", "Premium Dates")
      .field("slug", "premium-dates");
    expect(categoryRes.status).toBe(201);
    const categoryId = categoryRes.body.data.category._id as string;

    const productRes = await request(app)
      .post("/api/v1/products")
      .set(...authHeader(token))
      .field("name", "Ajwa Dates")
      .field("tagline", "Rich, soft Madinah dates")
      .field("description", "Premium Ajwa dates sourced from Madinah.")
      .field("origin", "Madinah, Saudi Arabia")
      .field("categories", JSON.stringify([categoryId]))
      .field(
        "variants",
        JSON.stringify([{ label: "500g", priceBDT: 1200, stock: 20, lowStockThreshold: 5 }])
      );
    expect(productRes.status).toBe(201);
    expect(productRes.body.data.product.slug).toBeTruthy();
    const slug = productRes.body.data.product.slug as string;

    const publicList = await request(app).get("/api/v1/products");
    expect(publicList.status).toBe(200);
    expect(publicList.body.data.products).toHaveLength(1);

    const publicDetail = await request(app).get(`/api/v1/products/${slug}`);
    expect(publicDetail.status).toBe(200);
    expect(publicDetail.body.data.product.name).toBe("Ajwa Dates");
  });

  it("404s when fetching an unknown product slug", async () => {
    const res = await request(app).get("/api/v1/products/does-not-exist");
    expect(res.status).toBe(404);
  });

  it("rejects product creation with an invalid payload (missing variants)", async () => {
    const { token } = await createAuthedUser({ role: "admin", email: "admin2@example.com" });
    const categoryRes = await request(app)
      .post("/api/v1/categories")
      .set(...authHeader(token))
      .field("name", "Gift Boxes")
      .field("slug", "gift-boxes");
    const categoryId = categoryRes.body.data.category._id as string;

    const res = await request(app)
      .post("/api/v1/products")
      .set(...authHeader(token))
      .field("name", "Broken Product")
      .field("tagline", "Missing variants")
      .field("description", "Should fail validation.")
      .field("origin", "Madinah")
      .field("categories", JSON.stringify([categoryId]))
      .field("variants", JSON.stringify([]));

    expect(res.status).toBe(400);
  });
});

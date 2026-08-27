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

async function seedOrder(totalBDT: number, createdAt: Date) {
  const order = await OrderModel.create({
    orderNumber: `SAP-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
    customer: (await createAuthedUser({ role: "customer" })).user._id,
    items: [
      {
        product: (await CategoryModel.create({ name: "Dates", slug: `d-${Date.now()}-${Math.random()}` }))._id,
        productName: "Ajwa Dates",
        variantId: "v1",
        variantLabel: "500g",
        unitPriceBDT: totalBDT,
        quantity: 1,
        lineTotalBDT: totalBDT,
      },
    ],
    shippingAddress,
    deliveryMethod: "standard",
    shippingFeeBDT: 0,
    paymentMethod: "cod",
    subtotalBDT: totalBDT,
    totalBDT,
    status: "delivered",
  });
  // Bypass Mongoose's timestamps middleware so the seeded date actually sticks.
  await OrderModel.collection.updateOne({ _id: order._id }, { $set: { createdAt } });
  return order;
}

describe("Reporting & analytics additions", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("buckets sales into a monthly time series", async () => {
    const { token } = await createAuthedUser({ role: "admin" });
    await seedOrder(1000, new Date("2026-01-15"));
    await seedOrder(500, new Date("2026-01-20"));
    await seedOrder(2000, new Date("2026-02-05"));

    const res = await request(app)
      .get("/api/v1/reports/sales-timeseries?groupBy=month")
      .set(...authHeader(token));
    expect(res.status).toBe(200);
    const series: { period: string; revenueBDT: number; orders: number }[] = res.body.data.timeSeries;
    const jan = series.find((s) => s.period === "2026-01");
    const feb = series.find((s) => s.period === "2026-02");
    expect(jan).toEqual({ period: "2026-01", revenueBDT: 1500, orders: 2 });
    expect(feb).toEqual({ period: "2026-02", revenueBDT: 2000, orders: 1 });
  });

  it("lists only genuinely out-of-stock products, distinct from low-stock", async () => {
    const { token } = await createAuthedUser({ role: "admin" });
    const category = await CategoryModel.create({ name: "Dates", slug: "dates-oos" });
    await ProductModel.create({
      name: "Zero Stock Dates",
      slug: "zero-stock-dates",
      tagline: "t",
      description: "d",
      origin: "Madinah",
      categories: [category._id],
      variants: [{ label: "500g", priceBDT: 1000, stock: 0, lowStockThreshold: 2 }],
    });
    await ProductModel.create({
      name: "Low Stock Dates",
      slug: "low-stock-dates",
      tagline: "t",
      description: "d",
      origin: "Madinah",
      categories: [category._id],
      variants: [{ label: "500g", priceBDT: 1000, stock: 1, lowStockThreshold: 5 }],
    });

    const res = await request(app).get("/api/v1/inventory/out-of-stock").set(...authHeader(token));
    expect(res.status).toBe(200);
    const names = res.body.data.products.map((p: { product: { name: string } }) => p.product.name);
    expect(names).toContain("Zero Stock Dates");
    expect(names).not.toContain("Low Stock Dates");
  });

  it("merges revenue and expense periods, including a period with only one side", async () => {
    const { token, user: admin } = await createAuthedUser({ role: "admin" });
    await seedOrder(3000, new Date("2026-03-10"));

    const expense = await ExpenseModel.create({
      category: "packaging",
      amountBDT: 500,
      incurredAt: new Date("2026-04-10"),
      reason: "Packaging materials",
      status: "confirmed",
      recordedBy: admin._id,
      recordedByRole: "admin",
    });
    await ExpenseModel.collection.updateOne({ _id: expense._id }, { $set: { incurredAt: new Date("2026-04-10") } });

    const res = await request(app)
      .get("/api/v1/finance/revenue-vs-expense?groupBy=month")
      .set(...authHeader(token));
    expect(res.status).toBe(200);
    const series: { period: string; revenueBDT: number; expenseBDT: number; profitBDT: number }[] =
      res.body.data.timeSeries;
    const march = series.find((s) => s.period === "2026-03");
    const april = series.find((s) => s.period === "2026-04");
    expect(march).toEqual({ period: "2026-03", revenueBDT: 3000, expenseBDT: 0, profitBDT: 3000 });
    expect(april).toEqual({ period: "2026-04", revenueBDT: 0, expenseBDT: 500, profitBDT: -500 });
  });

  it("generates a real, valid PDF for the sales report (not a browser print-to-PDF)", async () => {
    const { token } = await createAuthedUser({ role: "admin" });
    await seedOrder(1000, new Date());

    const res = await request(app)
      .get("/api/v1/reports/sales-timeseries/pdf?groupBy=day")
      .set(...authHeader(token))
      // Collect the raw bytes into a Buffer rather than letting supertest
      // guess a text/JSON parser for a binary application/pdf body.
      .buffer()
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    // Every valid PDF file starts with this exact magic-number signature.
    expect((res.body as Buffer).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("includes out-of-stock count, recent orders and recent activities on the admin dashboard", async () => {
    const { token } = await createAuthedUser({ role: "admin" });
    await seedOrder(1200, new Date());

    const res = await request(app).get("/api/v1/reports/dashboard").set(...authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.dashboard).toHaveProperty("outOfStockCount");
    expect(Array.isArray(res.body.data.dashboard.recentOrders)).toBe(true);
    expect(res.body.data.dashboard.recentOrders.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.data.dashboard.recentActivities)).toBe(true);
  });
});

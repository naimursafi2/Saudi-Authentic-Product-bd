import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { CategoryModel } from "../../models/Category.model";
import { ProductModel } from "../../models/Product.model";
import { PurchaseModel } from "../../models/Purchase.model";

/**
 * The Purchase/Landed-Cost system feeding the finance module's profit-and-loss
 * figures. `landedCost.integration.test.ts` proves an item's landed cost is
 * frozen onto the order correctly; this proves the finance endpoints then
 * charge that cost against profit, so `/finance/summary` and
 * `/finance/revenue-vs-expense` report what the business actually earned
 * rather than revenue minus operating expenses alone.
 */

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

async function seedProduct(priceBDT: number) {
  const category = await CategoryModel.create({
    name: "Dates",
    slug: `dates-${Math.random().toString(36).slice(2, 8)}`,
  });
  return ProductModel.create({
    name: "Ajwa Dates",
    slug: `ajwa-dates-${Math.random().toString(36).slice(2, 8)}`,
    tagline: "Rich, soft Madinah dates",
    description: "Premium Ajwa dates.",
    origin: "Madinah",
    categories: [category._id],
    variants: [{ label: "500g", priceBDT, stock: 0, lowStockThreshold: 2 }],
  });
}

async function receiveBatch(opts: {
  product: string;
  variantId: string;
  quantity: number;
  productCostBDT: number;
  costItemsBDT?: number[];
  recordedBy: string;
}) {
  await PurchaseModel.create({
    reference: `PUR-TEST-${Math.random().toString(36).slice(2, 8)}`,
    product: opts.product,
    variantId: opts.variantId,
    itemName: "Ajwa Dates - 500g",
    quantity: opts.quantity,
    unit: "pcs",
    productCostBDT: opts.productCostBDT,
    costItems: (opts.costItemsBDT ?? []).map((amountBDT, i) => ({
      name: `Cost ${i}`,
      amountBDT,
      addedBy: opts.recordedBy,
      addedAt: new Date(),
    })),
    status: "received",
    receivedAt: new Date(),
    remainingQuantity: opts.quantity,
    recordedBy: opts.recordedBy,
    recordedByRole: "super_admin",
  });
  await ProductModel.findOneAndUpdate(
    { _id: opts.product, "variants._id": opts.variantId },
    { $inc: { "variants.$.stock": opts.quantity } }
  );
}

describe("Finance profit & loss, sourced from real purchase costs", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("charges real landed cost and operating expenses against profit in the finance summary", async () => {
    const { token: superAdminToken, user: superAdmin } = await createAuthedUser({ role: "super_admin" });
    const { token: customerToken } = await createAuthedUser({ role: "customer" });

    const product = await seedProduct(1500);
    const variantId = product.variants[0]!._id!.toString();

    // 100 units at ৳1,000 each plus ৳5,000 shipping and ৳2,000 customs
    // = ৳107,000 landed for 100 units = ৳1,070 per unit.
    await receiveBatch({
      product: product._id.toString(),
      variantId,
      quantity: 100,
      productCostBDT: 100_000,
      costItemsBDT: [5000, 2000],
      recordedBy: superAdmin._id.toString(),
    });

    // Sell 4 units at ৳1,500 = ৳6,000 subtotal, no discount.
    const created = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(customerToken))
      .send({
        items: [{ productId: product._id.toString(), variantId, quantity: 4 }],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "cod",
      });
    expect(created.status).toBe(201);
    const order = created.body.data.order as { subtotalBDT: number; totalBDT: number; shippingFeeBDT: number };

    await request(app)
      .post("/api/v1/expenses")
      .set(...authHeader(superAdminToken))
      .send({ category: "software", amountBDT: 2000, reason: "Annual subscription renewal" });

    const res = await request(app).get("/api/v1/finance/summary").set(...authHeader(superAdminToken));
    expect(res.status).toBe(200);
    const summary = res.body.data.summary;

    const expectedCogs = 1070 * 4;
    expect(summary.costOfGoodsSoldBDT).toBe(expectedCogs);
    // Net selling revenue excludes the shipping fee — that is pass-through,
    // not merchandise revenue — while the top-line total still includes it.
    expect(summary.netSellingRevenueBDT).toBe(order.subtotalBDT);
    expect(summary.totalRevenueBDT).toBe(order.totalBDT);
    expect(summary.totalRevenueBDT).toBe(order.subtotalBDT + order.shippingFeeBDT);

    expect(summary.grossProfitBDT).toBe(order.subtotalBDT - expectedCogs);
    expect(summary.totalExpensesBDT).toBe(2000);
    expect(summary.netProfitBDT).toBe(summary.grossProfitBDT - 2000);
    // Nothing in this order fell back to an unknown cost basis — a batch
    // existed for every unit sold.
    expect(summary.ordersWithUnknownCostBasis).toBe(0);
  });

  it("reports a loss when goods cost plus expenses exceed what the sale earned", async () => {
    const { token: superAdminToken, user: superAdmin } = await createAuthedUser({ role: "super_admin" });
    const { token: customerToken } = await createAuthedUser({ role: "customer" });

    // Sold below cost: ৳900 landed per unit, sold at ৳800.
    const product = await seedProduct(800);
    const variantId = product.variants[0]!._id!.toString();
    await receiveBatch({
      product: product._id.toString(),
      variantId,
      quantity: 10,
      productCostBDT: 9000,
      recordedBy: superAdmin._id.toString(),
    });

    await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(customerToken))
      .send({
        items: [{ productId: product._id.toString(), variantId, quantity: 2 }],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "cod",
      })
      .expect(201);

    const res = await request(app).get("/api/v1/finance/summary").set(...authHeader(superAdminToken));
    const summary = res.body.data.summary;

    expect(summary.costOfGoodsSoldBDT).toBe(1800);
    expect(summary.netSellingRevenueBDT).toBe(1600);
    expect(summary.grossProfitBDT).toBe(-200);
    expect(summary.netProfitBDT).toBeLessThan(0);
  });

  it("flags a partial cost basis when an item sold with no purchase history behind it", async () => {
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
    const { token: customerToken } = await createAuthedUser({ role: "customer" });

    // Stock exists but no purchase batch was ever recorded for it, so there
    // is no cost to charge against the sale.
    const product = await seedProduct(1500);
    const variantId = product.variants[0]!._id!.toString();
    await ProductModel.findOneAndUpdate(
      { _id: product._id, "variants._id": variantId },
      { $set: { "variants.$.stock": 10 } }
    );

    await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(customerToken))
      .send({
        items: [{ productId: product._id.toString(), variantId, quantity: 1 }],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "cod",
      })
      .expect(201);

    const res = await request(app).get("/api/v1/finance/summary").set(...authHeader(superAdminToken));
    const summary = res.body.data.summary;

    expect(summary.costOfGoodsSoldBDT).toBe(0);
    // Surfaced rather than silently reading as a 100%-margin sale.
    expect(summary.ordersWithUnknownCostBasis).toBe(1);
  });

  it("breaks the same P&L down by period, with revenue, goods cost and expenses lining up", async () => {
    const { token: superAdminToken, user: superAdmin } = await createAuthedUser({ role: "super_admin" });
    const { token: customerToken } = await createAuthedUser({ role: "customer" });

    const product = await seedProduct(1500);
    const variantId = product.variants[0]!._id!.toString();
    await receiveBatch({
      product: product._id.toString(),
      variantId,
      quantity: 50,
      productCostBDT: 50_000,
      recordedBy: superAdmin._id.toString(),
    });

    await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(customerToken))
      .send({
        items: [{ productId: product._id.toString(), variantId, quantity: 3 }],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "cod",
      })
      .expect(201);

    await request(app)
      .post("/api/v1/expenses")
      .set(...authHeader(superAdminToken))
      .send({ category: "software", amountBDT: 500, reason: "Monthly tooling" });

    const res = await request(app)
      .get("/api/v1/finance/revenue-vs-expense?groupBy=day")
      .set(...authHeader(superAdminToken));
    expect(res.status).toBe(200);

    const series = res.body.data.timeSeries as {
      period: string;
      revenueBDT: number;
      netSellingRevenueBDT: number;
      costOfGoodsSoldBDT: number;
      grossProfitBDT: number;
      expenseBDT: number;
      profitBDT: number;
    }[];
    // Both the order and the expense landed today, so they share one bucket
    // rather than producing two half-populated rows.
    expect(series).toHaveLength(1);
    const [row] = series;
    expect(row.costOfGoodsSoldBDT).toBe(3000);
    expect(row.netSellingRevenueBDT).toBe(4500);
    expect(row.grossProfitBDT).toBe(1500);
    expect(row.expenseBDT).toBe(500);
    expect(row.profitBDT).toBe(1000);

    // The period rows must reconcile with the single-figure summary.
    const summaryRes = await request(app).get("/api/v1/finance/summary").set(...authHeader(superAdminToken));
    const summary = summaryRes.body.data.summary;
    expect(summary.netProfitBDT).toBe(series.reduce((sum, r) => sum + r.profitBDT, 0));
    expect(summary.costOfGoodsSoldBDT).toBe(series.reduce((sum, r) => sum + r.costOfGoodsSoldBDT, 0));
  });

  it("keeps the P&L endpoints behind finance.view", async () => {
    const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
    const { token: managerToken } = await createAuthedUser({ role: "order_manager" });
    const { token: employeeToken } = await createAuthedUser({ role: "employee" });

    for (const token of [coAdminToken, managerToken, employeeToken]) {
      for (const path of ["/api/v1/finance/summary", "/api/v1/finance/revenue-vs-expense", "/api/v1/finance/gross-profit"]) {
        const res = await request(app).get(path).set(...authHeader(token));
        expect(res.status).toBe(403);
      }
    }
  });
});

import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { CategoryModel } from "../../models/Category.model";
import { ProductModel } from "../../models/Product.model";
import { PurchaseModel } from "../../models/Purchase.model";
import { CouponModel } from "../../models/Coupon.model";
import { InventoryLogModel } from "../../models/InventoryLog.model";

const app = createApp();

async function seedProduct(priceBDT = 1500, stock = 0) {
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

/** Records and receives a batch directly against the DB (bypassing the API) so tests can control `receivedAt` ordering precisely. */
async function receiveBatch(opts: {
  product: string;
  variantId: string;
  quantity: number;
  productCostBDT: number;
  costItemsBDT?: number[];
  recordedBy: string;
}) {
  const purchase = await PurchaseModel.create({
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
  return purchase;
}

async function createFixedCoupon(amountBDT: number) {
  return CouponModel.create({
    code: `FLAT${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    discountType: "fixed",
    discountValue: amountBDT,
    minOrderAmountBDT: 0,
    startsAt: new Date(Date.now() - 60_000),
    expiresAt: new Date(Date.now() + 60_000),
    isActive: true,
  });
}

describe("Purchase Batch / Landed Cost system", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("freezes a sold item's actual landed unit cost onto the order and derives gross profit from it", async () => {
    const { user: superAdmin } = await createAuthedUser({ role: "super_admin" });
    const product = await seedProduct(1500);
    const variantId = product.variants[0]!._id!.toString();

    // 100 units @ ৳1,000 + ৳5,000 shipping + ৳2,000 customs = ৳107,000 landed, ৳1,070/unit.
    await receiveBatch({
      product: product._id.toString(),
      variantId,
      quantity: 100,
      productCostBDT: 100_000,
      costItemsBDT: [5000, 2000],
      recordedBy: superAdmin._id.toString(),
    });

    const coupon = await createFixedCoupon(100);
    const { token: customerToken } = await createAuthedUser({ role: "customer" });

    const created = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(customerToken))
      .send({
        items: [{ productId: product._id.toString(), variantId, quantity: 1 }],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "cod",
        couponCode: coupon.code,
      });

    expect(created.status).toBe(201);
    const order = created.body.data.order;
    expect(order.items[0].unitLandedCostBDT).toBe(1070);
    expect(order.items[0].costBasisKnown).toBe(true);
    expect(order.items[0].batchConsumptions).toHaveLength(1);
    expect(order.items[0].batchConsumptions[0].quantity).toBe(1);
    expect(order.items[0].batchConsumptions[0].unitCostBDT).toBe(1070);

    // Net selling revenue (1500 - 100 discount) - landed cost (1070) = 330.
    expect(order.costOfGoodsSoldBDT).toBe(1070);
    expect(order.grossProfitBDT).toBe(330);
    expect(order.costBasisFullyKnown).toBe(true);

    const inventoryLog = await InventoryLogModel.findOne({ product: product._id, reason: "order_placed" });
    expect(inventoryLog?.unitCostBDT).toBe(1070);
    expect(inventoryLog?.purchaseBatch).toBeDefined();
  });

  it("decrements the batch's remaining quantity on sale and restores it exactly on cancellation", async () => {
    const { user: superAdmin, token: superToken } = await createAuthedUser({ role: "super_admin" });
    const product = await seedProduct(1500);
    const variantId = product.variants[0]!._id!.toString();

    const batch = await receiveBatch({
      product: product._id.toString(),
      variantId,
      quantity: 20,
      productCostBDT: 20_000,
      recordedBy: superAdmin._id.toString(),
    });

    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    const created = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(customerToken))
      .send({
        items: [{ productId: product._id.toString(), variantId, quantity: 5 }],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "cod",
      });
    expect(created.status).toBe(201);
    const orderId = created.body.data.order._id;

    let reloaded = await PurchaseModel.findById(batch._id);
    expect(reloaded!.remainingQuantity).toBe(15);
    expect(reloaded!.soldQuantity).toBe(5);

    const cancelled = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set(...authHeader(superToken))
      .send({ status: "cancelled" });
    expect(cancelled.status).toBe(200);

    reloaded = await PurchaseModel.findById(batch._id);
    expect(reloaded!.remainingQuantity).toBe(20);
    expect(reloaded!.soldQuantity).toBe(0);

    const product2 = await ProductModel.findById(product._id);
    expect(product2!.variants[0]!.stock).toBe(20);
  });

  it("draws FIFO across multiple batches, oldest-received first, leaving each batch's own unit cost untouched", async () => {
    const { user: superAdmin } = await createAuthedUser({ role: "super_admin" });
    const product = await seedProduct(2000);
    const variantId = product.variants[0]!._id!.toString();

    const batchA = await receiveBatch({
      product: product._id.toString(),
      variantId,
      quantity: 5,
      productCostBDT: 5_000, // ৳1,000/unit
      recordedBy: superAdmin._id.toString(),
    });
    const batchB = await receiveBatch({
      product: product._id.toString(),
      variantId,
      quantity: 200,
      productCostBDT: 230_000, // ৳1,150/unit
      recordedBy: superAdmin._id.toString(),
    });

    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    const created = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(customerToken))
      .send({
        items: [{ productId: product._id.toString(), variantId, quantity: 8 }],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "cod",
      });

    expect(created.status).toBe(201);
    const item = created.body.data.order.items[0];
    expect(item.batchConsumptions).toHaveLength(2);
    expect(item.batchConsumptions[0].purchase).toBe(batchA._id.toString());
    expect(item.batchConsumptions[0].quantity).toBe(5);
    expect(item.batchConsumptions[0].unitCostBDT).toBe(1000);
    expect(item.batchConsumptions[1].purchase).toBe(batchB._id.toString());
    expect(item.batchConsumptions[1].quantity).toBe(3);
    expect(item.batchConsumptions[1].unitCostBDT).toBe(1150);
    // Weighted average across the draw: (5*1000 + 3*1150) / 8 = 1056.25
    expect(item.unitLandedCostBDT).toBeCloseTo(1056.25, 2);

    const reloadedA = await PurchaseModel.findById(batchA._id);
    const reloadedB = await PurchaseModel.findById(batchB._id);
    expect(reloadedA!.remainingQuantity).toBe(0);
    expect(reloadedB!.remainingQuantity).toBe(197);
    // Batch B's own unit cost is untouched by Batch A's separate cost basis.
    expect(reloadedB!.unitCostBDT).toBe(1150);
  });

  it("falls back to an unknown (zero) cost basis when no purchase-batch history exists for the variant", async () => {
    const product = await seedProduct(1500, 10);
    const variantId = product.variants[0]!._id!.toString();
    const { token: customerToken } = await createAuthedUser({ role: "customer" });

    const created = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(customerToken))
      .send({
        items: [{ productId: product._id.toString(), variantId, quantity: 2 }],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "cod",
      });

    expect(created.status).toBe(201);
    const item = created.body.data.order.items[0];
    expect(item.costBasisKnown).toBe(false);
    expect(item.unitLandedCostBDT).toBe(0);
    expect(item.batchConsumptions).toHaveLength(0);
    expect(created.body.data.order.costBasisFullyKnown).toBe(false);
  });

  it("falls back to the weighted average of prior batches once every batch's remaining quantity is exhausted", async () => {
    const { user: superAdmin } = await createAuthedUser({ role: "super_admin" });
    const product = await seedProduct(2000);
    const variantId = product.variants[0]!._id!.toString();

    await receiveBatch({
      product: product._id.toString(),
      variantId,
      quantity: 5,
      productCostBDT: 5_350, // ৳1,070/unit
      recordedBy: superAdmin._id.toString(),
    });

    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    // Sell all 5 units, exhausting the only batch's remaining quantity.
    const first = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(customerToken))
      .send({
        items: [{ productId: product._id.toString(), variantId, quantity: 5 }],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "cod",
      });
    expect(first.status).toBe(201);

    // Live stock still allows another 5 (manually topped up, no new batch) —
    // this sale has no batch remaining quantity to draw from at all.
    await ProductModel.findOneAndUpdate(
      { _id: product._id, "variants._id": variantId },
      { $inc: { "variants.$.stock": 5 } }
    );

    const second = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(customerToken))
      .send({
        items: [{ productId: product._id.toString(), variantId, quantity: 2 }],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "cod",
      });

    expect(second.status).toBe(201);
    const item = second.body.data.order.items[0];
    expect(item.batchConsumptions).toHaveLength(0);
    expect(item.costBasisKnown).toBe(true);
    expect(item.unitLandedCostBDT).toBe(1070);
  });

  it("exposes stock valued at its real landed cost via the finance inventory-valuation endpoint", async () => {
    const { user: superAdmin, token: superToken } = await createAuthedUser({ role: "super_admin" });
    const product = await seedProduct(1500);
    const variantId = product.variants[0]!._id!.toString();

    await receiveBatch({
      product: product._id.toString(),
      variantId,
      quantity: 100,
      productCostBDT: 100_000,
      costItemsBDT: [5000, 2000],
      recordedBy: superAdmin._id.toString(),
    });

    const res = await request(app)
      .get("/api/v1/finance/inventory-valuation")
      .set(...authHeader(superToken));

    expect(res.status).toBe(200);
    const row = res.body.data.variants.find((v: { productId: string }) => v.productId === product._id.toString());
    expect(row).toBeDefined();
    expect(row.stock).toBe(100);
    expect(row.averageUnitCostBDT).toBe(1070);
    expect(row.inventoryValueBDT).toBe(107_000);
    expect(res.body.data.totalInventoryValueBDT).toBeGreaterThanOrEqual(107_000);

    const coAdminBlocked = await createAuthedUser({ role: "co_admin" });
    const forbidden = await request(app)
      .get("/api/v1/finance/inventory-valuation")
      .set(...authHeader(coAdminBlocked.token));
    expect(forbidden.status).toBe(403);
  });

  it("reports a gross-profit time series from real sold-item landed costs, gated by finance.view", async () => {
    const { user: superAdmin, token: superToken } = await createAuthedUser({ role: "super_admin" });
    const product = await seedProduct(1500);
    const variantId = product.variants[0]!._id!.toString();

    await receiveBatch({
      product: product._id.toString(),
      variantId,
      quantity: 10,
      productCostBDT: 10_700, // ৳1,070/unit
      recordedBy: superAdmin._id.toString(),
    });

    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(customerToken))
      .send({
        items: [{ productId: product._id.toString(), variantId, quantity: 1 }],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "cod",
      });

    const res = await request(app)
      .get("/api/v1/finance/gross-profit?groupBy=day")
      .set(...authHeader(superToken));

    expect(res.status).toBe(200);
    expect(res.body.data.timeSeries.length).toBeGreaterThan(0);
    const totalProfit = res.body.data.timeSeries.reduce(
      (sum: number, row: { grossProfitBDT: number }) => sum + row.grossProfitBDT,
      0
    );
    // Selling price 1500, no discount, landed cost 1070 -> 430 profit.
    expect(totalProfit).toBe(430);
  });

  it("traces a batch back to the stock movements and orders that drew on it", async () => {
    const { user: superAdmin, token: superToken } = await createAuthedUser({ role: "super_admin" });
    const product = await seedProduct(1500);
    const variantId = product.variants[0]!._id!.toString();

    const batch = await receiveBatch({
      product: product._id.toString(),
      variantId,
      quantity: 10,
      productCostBDT: 10_000,
      recordedBy: superAdmin._id.toString(),
    });

    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    const created = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(customerToken))
      .send({
        items: [{ productId: product._id.toString(), variantId, quantity: 3 }],
        shippingAddress,
        deliveryMethod: "standard",
        paymentMethod: "cod",
      });

    const res = await request(app)
      .get(`/api/v1/purchases/${batch._id.toString()}/traceability`)
      .set(...authHeader(superToken));

    expect(res.status).toBe(200);
    expect(res.body.data.movements.length).toBeGreaterThan(0);
    expect(res.body.data.relatedOrders).toHaveLength(1);
    expect(res.body.data.relatedOrders[0].orderNumber).toBe(created.body.data.order.orderNumber);
    expect(res.body.data.relatedOrders[0].quantityDrawn).toBe(3);
  });
});

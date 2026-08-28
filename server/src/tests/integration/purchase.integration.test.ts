import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { CategoryModel } from "../../models/Category.model";
import { ProductModel } from "../../models/Product.model";
import { PurchaseModel } from "../../models/Purchase.model";
import { InventoryLogModel } from "../../models/InventoryLog.model";
import { PendingActionModel } from "../../models/PendingAction.model";

const app = createApp();

async function seedProduct(suffix = Math.random().toString(36).slice(2, 8)) {
  const category = await CategoryModel.create({ name: "Dates", slug: `dates-${suffix}` });
  return ProductModel.create({
    name: "Ajwa Dates",
    slug: `ajwa-dates-${suffix}`,
    tagline: "Rich, soft Madinah dates",
    description: "Premium Ajwa dates.",
    origin: "Madinah",
    categories: [category._id],
    variants: [{ label: "500g", priceBDT: 1000, stock: 5, lowStockThreshold: 2 }],
  });
}

async function liveStock(productId: string): Promise<number> {
  const product = await ProductModel.findById(productId);
  return product!.variants[0]!.stock;
}

describe("Purchases with fully flexible additional costs", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe("landed-cost maths", () => {
    it("derives landed cost and unit cost from arbitrarily-named cost items", async () => {
      const { token } = await createAuthedUser({ role: "super_admin" });

      const created = await request(app)
        .post("/api/v1/purchases")
        .set(...authHeader(token))
        .field("itemName", "Ajwa Dates 10kg carton")
        .field("quantity", "100")
        .field("productCostBDT", "50000")
        .field(
          "costItems",
          JSON.stringify([
            { name: "Shipping", amountBDT: 8000 },
            { name: "Customs", amountBDT: 4500, note: "Chittagong port" },
            { name: "Transport", amountBDT: 2500 },
          ])
        );

      expect(created.status).toBe(201);
      const purchase = created.body.data.purchase;
      expect(purchase.costItems).toHaveLength(3);
      expect(purchase.costItems.map((c: { name: string }) => c.name)).toEqual([
        "Shipping",
        "Customs",
        "Transport",
      ]);
      expect(purchase.additionalCostBDT).toBe(15000);
      expect(purchase.totalLandedCostBDT).toBe(65000);
      expect(purchase.unitCostBDT).toBe(650);
    });

    it("accepts a completely different cost vocabulary on another purchase", async () => {
      const { token } = await createAuthedUser({ role: "super_admin" });

      const created = await request(app)
        .post("/api/v1/purchases")
        .set(...authHeader(token))
        .field("itemName", "Vintage watches")
        .field("quantity", "4")
        .field("unit", "pcs")
        .field("productCostBDT", "40000")
        .field(
          "costItems",
          JSON.stringify([
            { name: "Parts", amountBDT: 3000 },
            { name: "Repair", amountBDT: 5000 },
            { name: "Supplier Fee", amountBDT: 2000 },
          ])
        );

      expect(created.status).toBe(201);
      expect(created.body.data.purchase.totalLandedCostBDT).toBe(50000);
      expect(created.body.data.purchase.unitCostBDT).toBe(12500);
    });

    it("recomputes the totals as costs are added and removed, with no stored total to go stale", async () => {
      const { token } = await createAuthedUser({ role: "super_admin" });

      const created = await request(app)
        .post("/api/v1/purchases")
        .set(...authHeader(token))
        .field("itemName", "Mixed dates")
        .field("quantity", "10")
        .field("productCostBDT", "1000");
      const id = created.body.data.purchase._id;
      expect(created.body.data.purchase.unitCostBDT).toBe(100);

      const added = await request(app)
        .post(`/api/v1/purchases/${id}/costs`)
        .set(...authHeader(token))
        .field("name", "Courier")
        .field("amountBDT", "500");
      expect(added.status).toBe(201);
      expect(added.body.data.purchase.totalLandedCostBDT).toBe(1500);
      expect(added.body.data.purchase.unitCostBDT).toBe(150);

      const costId = added.body.data.purchase.costItems[0]._id;
      const removed = await request(app)
        .delete(`/api/v1/purchases/${id}/costs/${costId}`)
        .set(...authHeader(token));
      expect(removed.status).toBe(200);
      expect(removed.body.data.purchase.costItems).toHaveLength(0);
      expect(removed.body.data.purchase.totalLandedCostBDT).toBe(1000);
      expect(removed.body.data.purchase.unitCostBDT).toBe(100);
    });

    it("keeps every batch of the same product separately in its cost history", async () => {
      const { token } = await createAuthedUser({ role: "super_admin" });
      const product = await seedProduct();
      const variantId = product.variants[0]!._id!.toString();

      for (const [cost, quantity] of [
        [10000, 100],
        [24000, 100],
      ]) {
        const created = await request(app)
          .post("/api/v1/purchases")
          .set(...authHeader(token))
          .field("product", product._id.toString())
          .field("variantId", variantId)
          .field("quantity", String(quantity))
          .field("productCostBDT", String(cost));
        await request(app)
          .patch(`/api/v1/purchases/${created.body.data.purchase._id}/receive`)
          .set(...authHeader(token))
          .send({});
      }

      const history = await request(app)
        .get(`/api/v1/purchases/product/${product._id.toString()}`)
        .set(...authHeader(token));

      expect(history.status).toBe(200);
      expect(history.body.data.purchases).toHaveLength(2);
      expect(history.body.data.totalQuantity).toBe(200);
      expect(history.body.data.totalLandedCostBDT).toBe(34000);
      // Weighted across both batches, not the mean of 100 and 240.
      expect(history.body.data.averageUnitCostBDT).toBe(170);
    });
  });

  describe("receiving a batch goes through the stock approval gate", () => {
    it("applies stock immediately for a super_admin and logs it as a purchase receipt", async () => {
      const { token } = await createAuthedUser({ role: "super_admin" });
      const product = await seedProduct();

      const created = await request(app)
        .post("/api/v1/purchases")
        .set(...authHeader(token))
        .field("product", product._id.toString())
        .field("variantId", product.variants[0]!._id!.toString())
        .field("quantity", "30")
        .field("productCostBDT", "9000");

      const received = await request(app)
        .patch(`/api/v1/purchases/${created.body.data.purchase._id}/receive`)
        .set(...authHeader(token))
        .send({});

      expect(received.status).toBe(200);
      expect(received.body.data.purchase.status).toBe("received");
      expect(await liveStock(product._id.toString())).toBe(35);

      const log = await InventoryLogModel.findOne({ product: product._id });
      expect(log?.reason).toBe("purchase_received");
      expect(log?.delta).toBe(30);
    });

    it("parks an admin's receipt in the approval queue and leaves live stock untouched", async () => {
      const { token: adminToken } = await createAuthedUser({ role: "admin" });
      const product = await seedProduct();

      const created = await request(app)
        .post("/api/v1/purchases")
        .set(...authHeader(adminToken))
        .field("product", product._id.toString())
        .field("variantId", product.variants[0]!._id!.toString())
        .field("quantity", "30")
        .field("productCostBDT", "9000");
      const purchaseId = created.body.data.purchase._id;

      const received = await request(app)
        .patch(`/api/v1/purchases/${purchaseId}/receive`)
        .set(...authHeader(adminToken))
        .send({});

      expect(received.status).toBe(202);
      expect(received.body.data.pendingActionId).toBeDefined();
      expect(received.body.data.purchase.status).toBe("awaiting_stock_approval");
      expect(await liveStock(product._id.toString())).toBe(5);
      expect(await InventoryLogModel.countDocuments()).toBe(0);

      const { token: superToken } = await createAuthedUser({ role: "super_admin" });
      const granted = await request(app)
        .patch(`/api/v1/pending-actions/${received.body.data.pendingActionId}/grant`)
        .set(...authHeader(superToken))
        .send({});

      expect(granted.status).toBe(200);
      expect(await liveStock(product._id.toString())).toBe(35);
      const purchase = await PurchaseModel.findById(purchaseId);
      expect(purchase?.status).toBe("received");
    });

    it("marks a purchase with no catalogue link received without touching stock", async () => {
      const { token } = await createAuthedUser({ role: "admin" });

      const created = await request(app)
        .post("/api/v1/purchases")
        .set(...authHeader(token))
        .field("itemName", "Packaging boxes")
        .field("quantity", "500")
        .field("productCostBDT", "12000");

      const received = await request(app)
        .patch(`/api/v1/purchases/${created.body.data.purchase._id}/receive`)
        .set(...authHeader(token))
        .send({});

      expect(received.status).toBe(200);
      expect(received.body.data.purchase.status).toBe("received");
      expect(await PendingActionModel.countDocuments()).toBe(0);
      expect(await InventoryLogModel.countDocuments()).toBe(0);
    });

    it("refuses to edit the cost breakdown of a received batch", async () => {
      const { token } = await createAuthedUser({ role: "super_admin" });

      const created = await request(app)
        .post("/api/v1/purchases")
        .set(...authHeader(token))
        .field("itemName", "Gift boxes")
        .field("quantity", "20")
        .field("productCostBDT", "4000");
      const id = created.body.data.purchase._id;

      await request(app)
        .patch(`/api/v1/purchases/${id}/receive`)
        .set(...authHeader(token))
        .send({});

      const res = await request(app)
        .post(`/api/v1/purchases/${id}/costs`)
        .set(...authHeader(token))
        .field("name", "Late invoice")
        .field("amountBDT", "300");

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/historical record/i);
    });
  });

  describe("RBAC", () => {
    it("rejects a co_admin deleting a purchase (Co-Admin never deletes)", async () => {
      const { token: superToken } = await createAuthedUser({ role: "super_admin" });
      const created = await request(app)
        .post("/api/v1/purchases")
        .set(...authHeader(superToken))
        .field("itemName", "Batch")
        .field("quantity", "1")
        .field("productCostBDT", "100");

      const { token: coToken } = await createAuthedUser({ role: "co_admin" });

      const res = await request(app)
        .delete(`/api/v1/purchases/${created.body.data.purchase._id}`)
        .set(...authHeader(coToken));
      expect(res.status).toBe(403);
    });

    it("rejects an employee, a customer and an anonymous caller outright", async () => {
      const { token: employeeToken } = await createAuthedUser({ role: "employee" });
      const { token: customerToken } = await createAuthedUser({ role: "customer" });

      expect((await request(app).get("/api/v1/purchases").set(...authHeader(employeeToken))).status).toBe(403);
      expect((await request(app).get("/api/v1/purchases").set(...authHeader(customerToken))).status).toBe(403);
      expect((await request(app).get("/api/v1/purchases")).status).toBe(401);
    });
  });

  describe("validation", () => {
    it("requires a variant when a catalogue product is linked", async () => {
      const { token } = await createAuthedUser({ role: "super_admin" });
      const product = await seedProduct();

      const res = await request(app)
        .post("/api/v1/purchases")
        .set(...authHeader(token))
        .field("product", product._id.toString())
        .field("quantity", "10")
        .field("productCostBDT", "1000");

      expect(res.status).toBe(400);
    });

    it("requires an item name when no catalogue product is linked", async () => {
      const { token } = await createAuthedUser({ role: "super_admin" });

      const res = await request(app)
        .post("/api/v1/purchases")
        .set(...authHeader(token))
        .field("quantity", "10")
        .field("productCostBDT", "1000");

      expect(res.status).toBe(400);
    });

    it("requires a name on every cost item", async () => {
      const { token } = await createAuthedUser({ role: "super_admin" });

      const created = await request(app)
        .post("/api/v1/purchases")
        .set(...authHeader(token))
        .field("itemName", "Batch")
        .field("quantity", "1")
        .field("productCostBDT", "100");

      const res = await request(app)
        .post(`/api/v1/purchases/${created.body.data.purchase._id}/costs`)
        .set(...authHeader(token))
        .field("name", "")
        .field("amountBDT", "300");

      expect(res.status).toBe(400);
    });
  });
});

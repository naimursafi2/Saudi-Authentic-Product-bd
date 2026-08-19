import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { CategoryModel } from "../../models/Category.model";
import { ProductModel } from "../../models/Product.model";
import { InventoryLogModel } from "../../models/InventoryLog.model";
import { AuditLogModel } from "../../models/AuditLog.model";

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

/** The live stock of a product's first variant. */
async function liveStock(productId: string): Promise<number> {
  const product = await ProductModel.findById(productId);
  return product!.variants[0]!.stock;
}

describe("Stock changes require Super Admin approval", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe("manual stock adjustment (POST /inventory/adjust)", () => {
    it("applies a super_admin's adjustment immediately and logs the history entry", async () => {
      const { token } = await createAuthedUser({ role: "super_admin" });
      const product = await seedProduct();

      const res = await request(app)
        .post("/api/v1/inventory/adjust")
        .set(...authHeader(token))
        .send({
          productId: product._id.toString(),
          variantId: product.variants[0]!._id!.toString(),
          delta: 20,
        });
      expect(res.status).toBe(200);
      expect(await liveStock(product._id.toString())).toBe(25);

      const log = await InventoryLogModel.findOne({ product: product._id });
      expect(log?.delta).toBe(20);
      expect(log?.balanceAfter).toBe(25);
    });

    it("queues a co_admin's adjustment without touching live stock until granted", async () => {
      const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
      const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
      const product = await seedProduct();

      const res = await request(app)
        .post("/api/v1/inventory/adjust")
        .set(...authHeader(coAdminToken))
        .send({
          productId: product._id.toString(),
          variantId: product.variants[0]!._id!.toString(),
          delta: 20,
        });
      expect(res.status).toBe(202);
      expect(res.body.data.pendingActionId).toBeTruthy();

      // Nothing moved, and no history was written for a change that hasn't happened.
      expect(await liveStock(product._id.toString())).toBe(5);
      expect(await InventoryLogModel.countDocuments({ product: product._id })).toBe(0);

      const grant = await request(app)
        .patch(`/api/v1/pending-actions/${res.body.data.pendingActionId}/grant`)
        .set(...authHeader(superAdminToken))
        .send({});
      expect(grant.status).toBe(200);

      expect(await liveStock(product._id.toString())).toBe(25);
      const log = await InventoryLogModel.findOne({ product: product._id });
      expect(log?.delta).toBe(20);
      expect(log?.balanceAfter).toBe(25);
    });

    it("gates an admin too — only super_admin is exempt", async () => {
      const { token: adminToken } = await createAuthedUser({ role: "admin" });
      const product = await seedProduct();

      const res = await request(app)
        .post("/api/v1/inventory/adjust")
        .set(...authHeader(adminToken))
        .send({
          productId: product._id.toString(),
          variantId: product.variants[0]!._id!.toString(),
          delta: -3,
        });
      expect(res.status).toBe(202);
      expect(await liveStock(product._id.toString())).toBe(5);
    });

    it("leaves live stock untouched when the request is denied", async () => {
      const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
      const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
      const product = await seedProduct();

      const res = await request(app)
        .post("/api/v1/inventory/adjust")
        .set(...authHeader(coAdminToken))
        .send({
          productId: product._id.toString(),
          variantId: product.variants[0]!._id!.toString(),
          delta: 50,
        });

      const deny = await request(app)
        .patch(`/api/v1/pending-actions/${res.body.data.pendingActionId}/deny`)
        .set(...authHeader(superAdminToken))
        .send({ note: "Not verified against a delivery note" });
      expect(deny.status).toBe(200);

      expect(await liveStock(product._id.toString())).toBe(5);
      expect(await InventoryLogModel.countDocuments({ product: product._id })).toBe(0);
    });

    it("re-evaluates the delta against current stock at grant time, not request time", async () => {
      const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
      const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
      const product = await seedProduct();

      const res = await request(app)
        .post("/api/v1/inventory/adjust")
        .set(...authHeader(coAdminToken))
        .send({
          productId: product._id.toString(),
          variantId: product.variants[0]!._id!.toString(),
          delta: 10,
        });

      // Two units sell while the request sits in the queue.
      const mid = await ProductModel.findById(product._id);
      mid!.variants[0]!.stock = 3;
      await mid!.save();

      await request(app)
        .patch(`/api/v1/pending-actions/${res.body.data.pendingActionId}/grant`)
        .set(...authHeader(superAdminToken))
        .send({});

      // 3 + 10, not the 15 a snapshot of request-time state would have given.
      expect(await liveStock(product._id.toString())).toBe(13);
    });
  });

  describe("stock submitted through the product form", () => {
    it("holds a co_admin's stock edit for approval while applying the rest of the edit immediately", async () => {
      const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
      const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
      const product = await seedProduct();

      const res = await request(app)
        .patch(`/api/v1/products/${product._id.toString()}`)
        .set(...authHeader(coAdminToken))
        .field("description", "A brand new description.")
        .field(
          "variants",
          JSON.stringify([{ label: "500g", priceBDT: 1200, stock: 99, lowStockThreshold: 2 }])
        );
      expect(res.status).toBe(200);
      expect(res.body.data.stockPendingActionId).toBeTruthy();

      const afterEdit = await ProductModel.findById(product._id);
      // Content and price landed straight away...
      expect(afterEdit!.description).toBe("A brand new description.");
      expect(afterEdit!.variants[0]!.priceBDT).toBe(1200);
      // ...but the stock did not.
      expect(afterEdit!.variants[0]!.stock).toBe(5);

      await request(app)
        .patch(`/api/v1/pending-actions/${res.body.data.stockPendingActionId}/grant`)
        .set(...authHeader(superAdminToken))
        .send({});

      expect(await liveStock(product._id.toString())).toBe(99);
      const log = await InventoryLogModel.findOne({ product: product._id });
      expect(log?.balanceAfter).toBe(99);
      expect(log?.delta).toBe(94);
    });

    it("writes a super_admin's stock edit straight through with no pending action", async () => {
      const { token } = await createAuthedUser({ role: "super_admin" });
      const product = await seedProduct();

      const res = await request(app)
        .patch(`/api/v1/products/${product._id.toString()}`)
        .set(...authHeader(token))
        .field(
          "variants",
          JSON.stringify([{ label: "500g", priceBDT: 1000, stock: 42, lowStockThreshold: 2 }])
        );
      expect(res.status).toBe(200);
      expect(res.body.data.stockPendingActionId).toBeUndefined();
      expect(await liveStock(product._id.toString())).toBe(42);
    });

    it("does not create an approval request for an edit that leaves stock alone", async () => {
      const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
      const product = await seedProduct();

      const res = await request(app)
        .patch(`/api/v1/products/${product._id.toString()}`)
        .set(...authHeader(coAdminToken))
        .field("name", "Ajwa Dates Reserve")
        .field(
          "variants",
          JSON.stringify([{ label: "500g", priceBDT: 1000, stock: 5, lowStockThreshold: 2 }])
        );
      expect(res.status).toBe(200);
      expect(res.body.data.stockPendingActionId).toBeUndefined();
    });

    it("creates a co_admin's product with zero stock until the quantity is approved", async () => {
      const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
      const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
      const category = await CategoryModel.create({ name: "Gifts", slug: "gifts" });

      const res = await request(app)
        .post("/api/v1/products")
        .set(...authHeader(coAdminToken))
        .field("name", "Gift Box")
        .field("tagline", "A curated gift box")
        .field("description", "Contains an assortment of dates.")
        .field("origin", "Madinah")
        .field("categories", JSON.stringify([category._id.toString()]))
        .field("variants", JSON.stringify([{ label: "Large", priceBDT: 3000, stock: 30 }]));
      expect(res.status).toBe(201);
      expect(res.body.data.stockPendingActionId).toBeTruthy();

      const created = await ProductModel.findById(res.body.data.product._id);
      expect(created!.variants[0]!.stock).toBe(0);

      await request(app)
        .patch(`/api/v1/pending-actions/${res.body.data.stockPendingActionId}/grant`)
        .set(...authHeader(superAdminToken))
        .send({});

      expect(await liveStock(created!._id.toString())).toBe(30);
    });
  });

  describe("variant identity across edits", () => {
    it("keeps a variant's _id when the form round-trips it, so cart/order lines aren't orphaned", async () => {
      const { token } = await createAuthedUser({ role: "super_admin" });
      const product = await seedProduct();
      const originalId = product.variants[0]!._id!.toString();

      const res = await request(app)
        .patch(`/api/v1/products/${product._id.toString()}`)
        .set(...authHeader(token))
        .field("description", "An unrelated description change.")
        .field(
          "variants",
          JSON.stringify([
            { id: originalId, label: "500g", priceBDT: 1000, stock: 5, lowStockThreshold: 2 },
          ])
        );
      expect(res.status).toBe(200);

      const after = await ProductModel.findById(product._id);
      expect(after!.variants[0]!._id!.toString()).toBe(originalId);
    });

    it("mints a fresh id for a newly added variant while preserving the existing one", async () => {
      const { token } = await createAuthedUser({ role: "super_admin" });
      const product = await seedProduct();
      const originalId = product.variants[0]!._id!.toString();

      await request(app)
        .patch(`/api/v1/products/${product._id.toString()}`)
        .set(...authHeader(token))
        .field(
          "variants",
          JSON.stringify([
            { id: originalId, label: "500g", priceBDT: 1000, stock: 5, lowStockThreshold: 2 },
            { label: "1kg", priceBDT: 1800, stock: 3, lowStockThreshold: 2 },
          ])
        );

      const after = await ProductModel.findById(product._id);
      expect(after!.variants).toHaveLength(2);
      expect(after!.variants[0]!._id!.toString()).toBe(originalId);
      expect(after!.variants[1]!._id!.toString()).not.toBe(originalId);
    });

    it("ignores a variant id that belongs to a different product", async () => {
      const { token } = await createAuthedUser({ role: "super_admin" });
      const productA = await seedProduct();
      const productB = await seedProduct();
      const foreignId = productB.variants[0]!._id!.toString();

      await request(app)
        .patch(`/api/v1/products/${productA._id.toString()}`)
        .set(...authHeader(token))
        .field(
          "variants",
          JSON.stringify([{ id: foreignId, label: "500g", priceBDT: 1000, stock: 5 }])
        );

      const after = await ProductModel.findById(productA._id);
      expect(after!.variants[0]!._id!.toString()).not.toBe(foreignId);
    });

    it("carries live stock by variant id, so reordering variants doesn't scramble it", async () => {
      const { token: superToken } = await createAuthedUser({ role: "super_admin" });
      const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
      const category = await CategoryModel.create({ name: "Dates", slug: "dates-reorder" });
      const product = await ProductModel.create({
        name: "Two Sizes",
        slug: "two-sizes",
        tagline: "Two sizes",
        description: "Two sizes.",
        origin: "Madinah",
        categories: [category._id],
        variants: [
          { label: "500g", priceBDT: 1000, stock: 5, lowStockThreshold: 2 },
          { label: "1kg", priceBDT: 1800, stock: 40, lowStockThreshold: 2 },
        ],
      });
      const smallId = product.variants[0]!._id!.toString();
      const largeId = product.variants[1]!._id!.toString();

      // Submit them the other way round, changing nothing but the order.
      await request(app)
        .patch(`/api/v1/products/${product._id.toString()}`)
        .set(...authHeader(coAdminToken))
        .field(
          "variants",
          JSON.stringify([
            { id: largeId, label: "1kg", priceBDT: 1800, stock: 40, lowStockThreshold: 2 },
            { id: smallId, label: "500g", priceBDT: 1000, stock: 5, lowStockThreshold: 2 },
          ])
        );

      const after = await ProductModel.findById(product._id);
      // Each variant kept its own stock rather than inheriting its neighbour's.
      expect(after!.variants.find((v) => v._id!.toString() === largeId)!.stock).toBe(40);
      expect(after!.variants.find((v) => v._id!.toString() === smallId)!.stock).toBe(5);
      void superToken;
    });
  });

  describe("overlapping stock requests", () => {
    it("flags two pending requests that target the same variant, in both directions", async () => {
      const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
      const { token: adminToken } = await createAuthedUser({ role: "admin" });
      const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
      const product = await seedProduct();
      const variantId = product.variants[0]!._id!.toString();

      const first = await request(app)
        .post("/api/v1/inventory/adjust")
        .set(...authHeader(coAdminToken))
        .send({ productId: product._id.toString(), variantId, delta: 10 });
      const second = await request(app)
        .post("/api/v1/inventory/adjust")
        .set(...authHeader(adminToken))
        .send({ productId: product._id.toString(), variantId, delta: -2 });

      const queue = await request(app)
        .get("/api/v1/pending-actions")
        .set(...authHeader(superAdminToken))
        .query({ status: "pending" });

      const byId = Object.fromEntries(
        queue.body.data.actions.map((a: { _id: string; conflictingActionIds: string[] }) => [
          a._id,
          a.conflictingActionIds,
        ])
      );
      expect(byId[first.body.data.pendingActionId]).toEqual([second.body.data.pendingActionId]);
      expect(byId[second.body.data.pendingActionId]).toEqual([first.body.data.pendingActionId]);
    });

    it("does not flag requests against different variants of the same product", async () => {
      const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
      const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
      const category = await CategoryModel.create({ name: "Dates", slug: "dates-two" });
      const product = await ProductModel.create({
        name: "Two Sizes",
        slug: "two-sizes-b",
        tagline: "Two sizes",
        description: "Two sizes.",
        origin: "Madinah",
        categories: [category._id],
        variants: [
          { label: "500g", priceBDT: 1000, stock: 5, lowStockThreshold: 2 },
          { label: "1kg", priceBDT: 1800, stock: 5, lowStockThreshold: 2 },
        ],
      });

      for (const variant of product.variants) {
        await request(app)
          .post("/api/v1/inventory/adjust")
          .set(...authHeader(coAdminToken))
          .send({
            productId: product._id.toString(),
            variantId: variant._id!.toString(),
            delta: 5,
          });
      }

      const queue = await request(app)
        .get("/api/v1/pending-actions")
        .set(...authHeader(superAdminToken))
        .query({ status: "pending" });
      for (const action of queue.body.data.actions) {
        expect(action.conflictingActionIds).toEqual([]);
      }
    });

    it("detects a conflict between a product-form stock update and a manual adjustment", async () => {
      const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
      const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
      const product = await seedProduct();
      const variantId = product.variants[0]!._id!.toString();

      await request(app)
        .post("/api/v1/inventory/adjust")
        .set(...authHeader(coAdminToken))
        .send({ productId: product._id.toString(), variantId, delta: 10 });

      const formEdit = await request(app)
        .patch(`/api/v1/products/${product._id.toString()}`)
        .set(...authHeader(coAdminToken))
        .field(
          "variants",
          JSON.stringify([{ id: variantId, label: "500g", priceBDT: 1000, stock: 77 }])
        );

      const queue = await request(app)
        .get("/api/v1/pending-actions")
        .set(...authHeader(superAdminToken))
        .query({ status: "pending" });

      const formAction = queue.body.data.actions.find(
        (a: { _id: string }) => a._id === formEdit.body.data.stockPendingActionId
      );
      expect(formAction.conflictingActionIds).toHaveLength(1);
    });

    it("clears the flag once the other request is resolved, and records the overlap on grant", async () => {
      const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
      const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
      const product = await seedProduct();
      const variantId = product.variants[0]!._id!.toString();

      const first = await request(app)
        .post("/api/v1/inventory/adjust")
        .set(...authHeader(coAdminToken))
        .send({ productId: product._id.toString(), variantId, delta: 10 });
      const second = await request(app)
        .post("/api/v1/inventory/adjust")
        .set(...authHeader(coAdminToken))
        .send({ productId: product._id.toString(), variantId, delta: 4 });

      await request(app)
        .patch(`/api/v1/pending-actions/${first.body.data.pendingActionId}/grant`)
        .set(...authHeader(superAdminToken))
        .send({});

      // The grant that raced another request left a trace in the audit log.
      const grantLog = await AuditLogModel.findOne({ action: "inventory.adjust.grant" });
      expect(grantLog!.note).toMatch(/1 other pending stock request/);

      // The survivor is no longer in conflict with anything.
      const queue = await request(app)
        .get("/api/v1/pending-actions")
        .set(...authHeader(superAdminToken))
        .query({ status: "pending" });
      const survivor = queue.body.data.actions.find(
        (a: { _id: string }) => a._id === second.body.data.pendingActionId
      );
      expect(survivor.conflictingActionIds).toEqual([]);

      // Deltas compose: 5 + 10 applied, +4 still waiting.
      expect(await liveStock(product._id.toString())).toBe(15);
    });
  });

  describe("read-only live stock", () => {
    it("serves the same live number to an employee as the storefront sees, and refuses write access", async () => {
      const { token: employeeToken } = await createAuthedUser({ role: "employee" });
      const product = await seedProduct();

      const res = await request(app)
        .get("/api/v1/inventory/stock")
        .set(...authHeader(employeeToken));
      expect(res.status).toBe(200);
      expect(res.body.data.products[0].variants[0].stock).toBe(5);
      expect(res.body.data.products[0].totalStock).toBe(5);

      // Reading is allowed; changing is not.
      const write = await request(app)
        .post("/api/v1/inventory/adjust")
        .set(...authHeader(employeeToken))
        .send({
          productId: product._id.toString(),
          variantId: product.variants[0]!._id!.toString(),
          delta: 5,
        });
      expect(write.status).toBe(403);
    });
  });
});

describe("Product title/description edits are logged, not gated", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("applies a co_admin's title and description edit immediately and records old/new values", async () => {
    const { token, user } = await createAuthedUser({ role: "co_admin" });
    const product = await seedProduct();

    const res = await request(app)
      .patch(`/api/v1/products/${product._id.toString()}`)
      .set(...authHeader(token))
      .field("name", "Premium Ajwa Dates")
      .field("description", "Hand-picked from Madinah.");
    expect(res.status).toBe(200);
    // No approval involved at all.
    expect(res.body.data.stockPendingActionId).toBeUndefined();

    const updated = await ProductModel.findById(product._id);
    expect(updated!.name).toBe("Premium Ajwa Dates");
    expect(updated!.description).toBe("Hand-picked from Madinah.");

    const log = await AuditLogModel.findOne({ action: "product.update", resource: "Product" });
    expect(log).not.toBeNull();
    expect(log!.actor.toString()).toBe(user._id.toString());
    expect(log!.actorRole).toBe("co_admin");
    expect(log!.oldValue).toMatchObject({ name: "Ajwa Dates", description: "Premium Ajwa dates." });
    expect(log!.newValue).toMatchObject({
      name: "Premium Ajwa Dates",
      description: "Hand-picked from Madinah.",
    });
    expect(log!.createdAt).toBeInstanceOf(Date);
  });

  it("logs an admin's edit the same way, naming only the fields that actually changed", async () => {
    const { token } = await createAuthedUser({ role: "admin" });
    const product = await seedProduct();

    await request(app)
      .patch(`/api/v1/products/${product._id.toString()}`)
      .set(...authHeader(token))
      .field("name", "Ajwa Dates")            // unchanged
      .field("description", "Rewritten copy."); // changed

    const log = await AuditLogModel.findOne({ action: "product.update" });
    expect(log!.actorRole).toBe("admin");
    expect(log!.note).toBe("Edited: description");
    expect(Object.keys(log!.newValue as object)).toEqual(["description"]);
  });

  it("writes no audit entry when a submit changes nothing", async () => {
    const { token } = await createAuthedUser({ role: "admin" });
    const product = await seedProduct();

    await request(app)
      .patch(`/api/v1/products/${product._id.toString()}`)
      .set(...authHeader(token))
      .field("name", "Ajwa Dates");

    expect(await AuditLogModel.countDocuments({ action: "product.update" })).toBe(0);
  });

  it("exposes the edit history to a super admin at /audit-logs", async () => {
    const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
    const product = await seedProduct();

    await request(app)
      .patch(`/api/v1/products/${product._id.toString()}`)
      .set(...authHeader(coAdminToken))
      .field("description", "Updated by co-admin.");

    const res = await request(app)
      .get("/api/v1/audit-logs")
      .set(...authHeader(superAdminToken))
      .query({ action: "product.update" });
    expect(res.status).toBe(200);
    expect(res.body.data.logs).toHaveLength(1);
    expect(res.body.data.logs[0].actorRole).toBe("co_admin");
  });
});

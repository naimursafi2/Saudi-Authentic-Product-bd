import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { CategoryModel } from "../../models/Category.model";
import { ProductModel } from "../../models/Product.model";
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

describe("Approval-gate system (pending_actions) and audit logging", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("lets super_admin delete a product directly, blocks admin entirely, and gates co_admin via a pending action", async () => {
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });

    const productA = await seedProduct();
    const directDelete = await request(app)
      .delete(`/api/v1/products/${productA._id.toString()}`)
      .set(...authHeader(superAdminToken));
    expect(directDelete.status).toBe(200);
    expect(await ProductModel.findById(productA._id)).toBeNull();

    const productB = await seedProduct();
    const adminAttempt = await request(app)
      .delete(`/api/v1/products/${productB._id.toString()}`)
      .set(...authHeader(adminToken));
    expect(adminAttempt.status).toBe(403);
    expect(await ProductModel.findById(productB._id)).not.toBeNull();

    const coAdminAttempt = await request(app)
      .delete(`/api/v1/products/${productB._id.toString()}`)
      .set(...authHeader(coAdminToken));
    expect(coAdminAttempt.status).toBe(202);
    const pendingActionId = coAdminAttempt.body.data.pendingActionId;
    // Not deleted yet — only granted actions take effect.
    expect(await ProductModel.findById(productB._id)).not.toBeNull();

    const grant = await request(app)
      .patch(`/api/v1/pending-actions/${pendingActionId}/grant`)
      .set(...authHeader(superAdminToken))
      .send({ note: "Looks fine" });
    expect(grant.status).toBe(200);
    expect(await ProductModel.findById(productB._id)).toBeNull();
  });

  it("lets super_admin deny a pending action, leaving the underlying resource untouched", async () => {
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
    const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
    const product = await seedProduct();

    const request1 = await request(app)
      .delete(`/api/v1/products/${product._id.toString()}`)
      .set(...authHeader(coAdminToken));
    expect(request1.status).toBe(202);

    const deny = await request(app)
      .patch(`/api/v1/pending-actions/${request1.body.data.pendingActionId}/deny`)
      .set(...authHeader(superAdminToken))
      .send({ note: "Keep it for now" });
    expect(deny.status).toBe(200);
    expect(deny.body.data.action.status).toBe("denied");
    expect(await ProductModel.findById(product._id)).not.toBeNull();

    // A resolved action can't be granted/denied a second time.
    const secondGrant = await request(app)
      .patch(`/api/v1/pending-actions/${request1.body.data.pendingActionId}/grant`)
      .set(...authHeader(superAdminToken))
      .send({});
    expect(secondGrant.status).toBe(400);
  });

  it("only super_admin can list or review pending actions", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const res = await request(app).get("/api/v1/pending-actions").set(...authHeader(adminToken));
    expect(res.status).toBe(403);
  });

  it("records an audit-log entry for a role change, visible to super_admin/admin", async () => {
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
    const { user: employee } = await createAuthedUser({ role: "employee" });

    const roleChange = await request(app)
      .patch(`/api/v1/users/${employee._id.toString()}/role`)
      .set(...authHeader(superAdminToken))
      .send({ role: "co_admin" });
    expect(roleChange.status).toBe(200);

    const logs = await AuditLogModel.find({ action: "user.role.update" });
    expect(logs).toHaveLength(1);
    expect(logs[0].resourceId).toBe(employee._id.toString());

    const listRes = await request(app)
      .get("/api/v1/audit-logs")
      .set(...authHeader(superAdminToken));
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.logs.some((l: { action: string }) => l.action === "user.role.update")).toBe(true);
  });

  it("scopes audit-log visibility to a non-admin viewer's own actions only", async () => {
    const { token: coAdminAToken, user: coAdminA } = await createAuthedUser({
      role: "co_admin",
      email: "co-admin-a@example.com",
    });
    const { token: coAdminBToken } = await createAuthedUser({ role: "co_admin", email: "co-admin-b@example.com" });
    void coAdminA;

    // co_admin A takes an auditable action (auto-approved coupon create).
    await request(app)
      .post("/api/v1/coupons")
      .set(...authHeader(coAdminAToken))
      .send({
        code: "AUDITME",
        discountType: "percentage",
        discountValue: 5,
        startsAt: new Date(Date.now() - 3600000).toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

    const asA = await request(app).get("/api/v1/audit-logs").set(...authHeader(coAdminAToken));
    expect(asA.body.data.logs.length).toBeGreaterThan(0);

    const asB = await request(app).get("/api/v1/audit-logs").set(...authHeader(coAdminBToken));
    expect(asB.body.data.logs).toHaveLength(0);
  });

  it("lets super_admin edit approval thresholds, and blocks admin from doing so", async () => {
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
    const { token: adminToken } = await createAuthedUser({ role: "admin" });

    const blocked = await request(app)
      .patch("/api/v1/approval-settings")
      .set(...authHeader(adminToken))
      .send({ couponAutoApprovePercent: 15 });
    expect(blocked.status).toBe(403);

    const updated = await request(app)
      .patch("/api/v1/approval-settings")
      .set(...authHeader(superAdminToken))
      .send({ couponAutoApprovePercent: 15 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.settings.couponAutoApprovePercent).toBe(15);

    // The new threshold takes effect immediately for the coupon gate.
    const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
    const coupon = await request(app)
      .post("/api/v1/coupons")
      .set(...authHeader(coAdminToken))
      .send({
        code: "NOWOK",
        discountType: "percentage",
        discountValue: 15,
        startsAt: new Date(Date.now() - 3600000).toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });
    expect(coupon.status).toBe(201);
  });
});

import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { StaticPageModel } from "../../models/StaticPage.model";

/**
 * The Return & Refund Policy is a `StaticPage`, not hardcoded copy — it is
 * seeded lazily like the other pages, served publicly, and editable from the
 * admin panel. Co-Admin edits it through `content.refundPolicy.manage`, which
 * deliberately reaches this one page and no other.
 */

const app = createApp();

describe("Return & Refund Policy content", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("serves the policy publicly, seeded from the database rather than hardcoded copy", async () => {
    const res = await request(app).get("/api/v1/static-pages/refundPolicy");
    expect(res.status).toBe(200);

    const page = res.body.data.page;
    expect(page.type).toBe("refundPolicy");
    expect(page.blocks.length).toBeGreaterThan(0);

    // The business rule the policy has to state plainly for customers.
    const text = page.blocks.map((b: { body: string }) => b.body).join(" ");
    expect(text).toMatch(/never .*recorded again as a separate sale, expense, or cost/i);

    // It is a real document, so it can be edited — not a constant in code.
    const stored = await StaticPageModel.findOne({ type: "refundPolicy" });
    expect(stored).not.toBeNull();
  });

  it("lets Super Admin, Admin and Co-Admin all update it, and shows the edit publicly", async () => {
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });

    for (const [label, token] of [
      ["super admin", superAdminToken],
      ["admin", adminToken],
      ["co admin", coAdminToken],
    ] as const) {
      const res = await request(app)
        .patch("/api/v1/static-pages/refundPolicy")
        .set(...authHeader(token))
        .field("heroTitle", `Policy edited by ${label}`)
        .field("blocks", JSON.stringify([{ title: "Section", body: `Body by ${label}`, isVisible: true }]));
      expect(res.status).toBe(200);

      // The storefront reads the same document, so the edit is live at once.
      const publicRes = await request(app).get("/api/v1/static-pages/refundPolicy");
      expect(publicRes.body.data.page.heroTitle).toBe(`Policy edited by ${label}`);
      expect(publicRes.body.data.page.blocks[0].body).toBe(`Body by ${label}`);
    }
  });

  it("confines Co-Admin's page permission to the refund policy alone", async () => {
    const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });

    // The one page it may edit.
    await request(app)
      .patch("/api/v1/static-pages/refundPolicy")
      .set(...authHeader(coAdminToken))
      .field("heroTitle", "Allowed")
      .expect(200);

    // Every other page stays behind `content.pages.manage`, which Co-Admin
    // does not hold — the narrow key must not become a way in.
    for (const type of ["about", "contact", "shippingPolicy"]) {
      const res = await request(app)
        .patch(`/api/v1/static-pages/${type}`)
        .set(...authHeader(coAdminToken))
        .field("heroTitle", "Should not apply");
      expect(res.status).toBe(403);
    }

    const about = await StaticPageModel.findOne({ type: "about" });
    expect(about?.heroTitle).not.toBe("Should not apply");
  });

  it("keeps the policy read-only for roles with no content permission", async () => {
    const { token: employeeToken } = await createAuthedUser({ role: "employee" });
    const { token: managerToken } = await createAuthedUser({ role: "order_manager" });

    for (const token of [employeeToken, managerToken]) {
      const res = await request(app)
        .patch("/api/v1/static-pages/refundPolicy")
        .set(...authHeader(token))
        .field("heroTitle", "Nope");
      expect(res.status).toBe(403);
    }
  });
});

/**
 * Deliberately does NOT mock `config/sslcommerz`, unlike
 * `payment.integration.test.ts`. This file pins the behaviour of a deployment
 * where SSLCommerz is not live — under jest it never is (see
 * `isSslcommerzConfigured` in config/env.ts) — which is why the option is
 * absent from checkout.
 */
import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";

const app = createApp();

describe("SSLCommerz gateway configuration status", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("reports online payment as unavailable publicly when the gateway is not live", async () => {
    const res = await request(app).get("/api/v1/payments/config");

    expect(res.status).toBe(200);
    expect(res.body.data.providers.sslcommerz).toBe(false);
  });

  it("tells staff the gateway mode, and names missing variables but never their values", async () => {
    const { token } = await createAuthedUser({ role: "admin" });

    const res = await request(app)
      .get("/api/v1/payments/gateway-status")
      .set(...authHeader(token));

    expect(res.status).toBe(200);
    expect(["sandbox", "live"]).toContain(res.body.data.sslcommerz.mode);
    expect(Array.isArray(res.body.data.sslcommerz.missingKeys)).toBe(true);
    for (const key of res.body.data.sslcommerz.missingKeys as string[]) {
      expect(["SSLCOMMERZ_STORE_ID", "SSLCOMMERZ_STORE_PASSWORD"]).toContain(key);
    }
    expect(JSON.stringify(res.body)).not.toMatch(/store_?passw(or)?d["']?\s*:/i);
  });

  it("keeps the diagnostics staff-only", async () => {
    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    const { token: managerToken } = await createAuthedUser({ role: "order_manager" });

    expect((await request(app).get("/api/v1/payments/gateway-status")).status).toBe(401);
    expect(
      (await request(app).get("/api/v1/payments/gateway-status").set(...authHeader(customerToken))).status
    ).toBe(403);
    expect(
      (await request(app).get("/api/v1/payments/gateway-status").set(...authHeader(managerToken))).status
    ).toBe(200);
  });

  it("refuses to start a payment with a clear 4xx/503 rather than failing obscurely", async () => {
    const { token } = await createAuthedUser({ role: "customer" });

    const res = await request(app)
      .post("/api/v1/payments/sslcommerz/init")
      .set(...authHeader(token))
      .send({ orderId: "0123456789abcdef01234567" });

    expect([404, 503]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toMatch(/store_?passw/i);
  });

  it("no longer exposes any bKash endpoint", async () => {
    const { token } = await createAuthedUser({ role: "customer" });
    const res = await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(token))
      .send({ orderId: "0123456789abcdef01234567" });
    expect(res.status).toBe(404);
  });
});

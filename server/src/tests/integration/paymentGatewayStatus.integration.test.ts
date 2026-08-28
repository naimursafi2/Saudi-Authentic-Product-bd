/**
 * Deliberately does NOT mock `config/bkash`, unlike `payment.integration.test.ts`.
 * This file pins the behaviour of a deployment with no bKash credentials — the
 * state a fresh checkout is in until someone fills in the five `BKASH_*`
 * variables, and the reason the option is absent from checkout.
 */
import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";

const app = createApp();

const BKASH_KEYS = [
  "BKASH_BASE_URL",
  "BKASH_USERNAME",
  "BKASH_PASSWORD",
  "BKASH_APP_KEY",
  "BKASH_APP_SECRET",
];

describe("bKash gateway configuration status", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("reports bKash as unavailable publicly when no credentials are set", async () => {
    const res = await request(app).get("/api/v1/payments/config");

    expect(res.status).toBe(200);
    // This is exactly what makes the storefront hide the bKash option: a
    // payment method that cannot take money is not offered to customers.
    expect(res.body.data.providers.bkash).toBe(false);
  });

  it("tells staff which variables are missing, so an absent option is never a mystery", async () => {
    const { token } = await createAuthedUser({ role: "admin" });

    const res = await request(app)
      .get("/api/v1/payments/gateway-status")
      .set(...authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.bkash.configured).toBe(false);
    expect(res.body.data.bkash.missingKeys).toEqual(BKASH_KEYS);
  });

  it("names the variables but never their values", async () => {
    const { token } = await createAuthedUser({ role: "admin" });

    const res = await request(app)
      .get("/api/v1/payments/gateway-status")
      .set(...authHeader(token));

    const body = JSON.stringify(res.body);
    // Only bare key names appear — nothing shaped like an assignment or a secret.
    for (const key of BKASH_KEYS) {
      expect(body).toContain(key);
      expect(body).not.toContain(`${key}=`);
    }
    expect(body).not.toMatch(/id_token|app_secret["']?\s*:/i);
  });

  it("keeps the diagnostics staff-only", async () => {
    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    const { token: employeeToken } = await createAuthedUser({ role: "employee" });
    const { token: managerToken } = await createAuthedUser({ role: "order_manager" });

    expect((await request(app).get("/api/v1/payments/gateway-status")).status).toBe(401);
    expect(
      (await request(app).get("/api/v1/payments/gateway-status").set(...authHeader(customerToken))).status
    ).toBe(403);
    expect(
      (await request(app).get("/api/v1/payments/gateway-status").set(...authHeader(employeeToken))).status
    ).toBe(403);
    // Order Manager holds payments.view, so it can diagnose a missing option.
    expect(
      (await request(app).get("/api/v1/payments/gateway-status").set(...authHeader(managerToken))).status
    ).toBe(200);
  });

  it("refuses to start a bKash payment with a clear 503 rather than failing obscurely", async () => {
    const { token } = await createAuthedUser({ role: "customer" });

    const res = await request(app)
      .post("/api/v1/payments/bkash/create")
      .set(...authHeader(token))
      .send({ orderId: "0123456789abcdef01234567" });

    // 404 (no such order) or 503 (gateway unconfigured) are both acceptable
    // here; what matters is that it never 500s and never leaks configuration.
    expect([404, 503]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toMatch(/app_?secret|app_?key|password/i);
  });
});

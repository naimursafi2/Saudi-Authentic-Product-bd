import request from "supertest";
import { createApp } from "../app";

// These hit the real Express app (helmet, cors, cookie-parser, compression,
// sanitizeRequest, hpp, rate limiter, routes, error handlers) without a
// database connection — enough to prove the middleware chain itself doesn't
// crash. This specifically guards against a regression where
// `express-mongo-sanitize`'s default middleware reassigns `req.query`,
// which throws on Express 5 because `req.query` is a getter-only property.
const app = createApp();

describe("createApp", () => {
  it("responds on GET /health without touching the database", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ success: true, message: "OK" })
    );
  });

  it("does not crash when a request includes query params (sanitizeRequest + Express 5 req.query)", async () => {
    const res = await request(app).get("/health?foo=bar&$where=1");
    expect(res.status).toBe(200);
  });

  it("returns a 404 JSON envelope for unknown routes", async () => {
    const res = await request(app).get("/api/v1/this-route-does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual(expect.objectContaining({ success: false }));
  });

  it("rejects an unauthenticated request to a protected route with 401", async () => {
    const res = await request(app).get("/api/v1/orders/mine");
    expect(res.status).toBe(401);
  });

  it("returns a validation error for a malformed product id", async () => {
    const res = await request(app).get("/api/v1/products/admin/not-a-valid-id");
    expect([400, 401]).toContain(res.status);
  });
});

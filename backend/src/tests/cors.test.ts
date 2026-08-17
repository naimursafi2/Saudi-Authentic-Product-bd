process.env.CLIENT_ORIGIN = "http://localhost:3000, http://localhost:3002 ,";

import request from "supertest";
import { clientOrigins } from "../config/env";
import { createApp } from "../app";

describe("clientOrigins", () => {
  it("splits, trims and drops empty entries from a comma-separated CLIENT_ORIGIN", () => {
    expect(clientOrigins).toEqual(["http://localhost:3000", "http://localhost:3002"]);
  });
});

describe("CORS allow-list", () => {
  const app = createApp();

  it("echoes back an allowed origin from a comma-separated list", async () => {
    const res = await request(app).get("/health").set("Origin", "http://localhost:3002");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3002");
  });

  it("allows the other origin in the same list too", async () => {
    const res = await request(app).get("/health").set("Origin", "http://localhost:3000");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  it("does not echo an origin that isn't in the allow-list", async () => {
    const res = await request(app).get("/health").set("Origin", "http://evil.example.com");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("still serves requests with no Origin header at all (curl, server-to-server)", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });
});

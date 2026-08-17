import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";

const app = createApp();

const registerPayload = {
  name: "Jane Customer",
  email: "jane@example.com",
  password: "Password123",
  confirmPassword: "Password123",
};

describe("Auth integration (register/login/me/logout against a real DB)", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("registers a new customer, hashes the password, and sets auth cookies", async () => {
    const res = await request(app).post("/api/v1/auth/register").send(registerPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(registerPayload.email);
    expect(res.body.data.user.role).toBe("customer");
    expect(res.body.data.user.password).toBeUndefined();

    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((c) => c.startsWith("accessToken="))).toBe(true);
    expect(cookies.some((c) => c.startsWith("refreshToken="))).toBe(true);
  });

  it("rejects registering the same email twice with 409", async () => {
    await request(app).post("/api/v1/auth/register").send(registerPayload);
    const res = await request(app).post("/api/v1/auth/register").send(registerPayload);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("rejects a weak password at the validation layer", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...registerPayload, email: "weak@example.com", password: "weak", confirmPassword: "weak" });

    expect(res.status).toBe(400);
  });

  it("logs in with correct credentials and rejects incorrect ones", async () => {
    await request(app).post("/api/v1/auth/register").send(registerPayload);

    const wrongPassword = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: registerPayload.email, password: "WrongPass123" });
    expect(wrongPassword.status).toBe(401);

    const ok = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: registerPayload.email, password: registerPayload.password });
    expect(ok.status).toBe(200);
    expect(ok.body.data.user.email).toBe(registerPayload.email);
  });

  it("returns the current user for GET /auth/me via the accessToken cookie, and 401 without one", async () => {
    const registerRes = await request(app).post("/api/v1/auth/register").send(registerPayload);
    const accessToken = registerRes.body.data.accessToken as string;

    const authed = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(authed.status).toBe(200);
    expect(authed.body.data.user.email).toBe(registerPayload.email);

    const unauthed = await request(app).get("/api/v1/auth/me");
    expect(unauthed.status).toBe(401);
  });

  it("clears auth cookies on logout", async () => {
    const res = await request(app).post("/api/v1/auth/logout");
    expect(res.status).toBe(200);
    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((c) => c.startsWith("accessToken=;"))).toBe(true);
  });
});

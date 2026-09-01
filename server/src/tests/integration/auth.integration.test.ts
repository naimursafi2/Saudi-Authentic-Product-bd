import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { UserModel } from "../../models/User.model";

/** Registers, then completes the new OTP step directly against the DB
 * (mirrors how order.integration tests pull the delivery OTP) so the rest of
 * a test can act as a fully signed-in customer. */
async function registerAndVerify(app: ReturnType<typeof createApp>, payload: Record<string, string>) {
  await request(app).post("/api/v1/auth/register").send(payload);
  const user = await UserModel.findOne({ email: payload.email }).select("+emailVerificationOtp");
  const code = user!.emailVerificationOtp!;
  return request(app).post("/api/v1/auth/verify-registration-otp").send({ email: payload.email, code });
}

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

  it("registers a new customer as unverified and emails an OTP, without signing them in yet", async () => {
    const res = await request(app).post("/api/v1/auth/register").send(registerPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.requiresOtpVerification).toBe(true);
    expect(res.body.data.email).toBe(registerPayload.email);

    const noCookies = (res.headers["set-cookie"] as unknown as string[]) ?? [];
    expect(noCookies.some((c) => c.startsWith("accessToken="))).toBe(false);

    const stored = await UserModel.findOne({ email: registerPayload.email }).select("+password");
    expect(stored?.role).toBe("customer");
    expect(stored?.isEmailVerified).toBe(false);
    expect(stored?.password).not.toBe(registerPayload.password); // hashed, not plaintext
  });

  it("hands out real auth cookies once the emailed OTP is confirmed", async () => {
    const res = await registerAndVerify(app, registerPayload);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(registerPayload.email);
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
    const verifyRes = await registerAndVerify(app, registerPayload);
    const accessToken = verifyRes.body.data.accessToken as string;

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

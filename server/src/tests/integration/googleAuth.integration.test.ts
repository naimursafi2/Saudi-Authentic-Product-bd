import request from "supertest";
import { createApp } from "../../app";
import { UserModel } from "../../models/User.model";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";

// The real verifier calls Google. Mocking it keeps the test deterministic
// while still exercising the whole route -> controller -> service path,
// including the new-user vs existing-user branch in authService.googleAuth.
const verifyGoogleIdToken = jest.fn();
jest.mock("../../config/google", () => ({
  verifyGoogleIdToken: (idToken: string) => verifyGoogleIdToken(idToken),
}));

const app = createApp();

const profile = { email: "gmail.user@example.com", name: "Gmail User", picture: undefined };

describe("Google sign-in integration (POST /auth/google)", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  beforeEach(() => {
    verifyGoogleIdToken.mockReset();
    verifyGoogleIdToken.mockResolvedValue(profile);
  });

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("registers a brand-new customer, pre-verified, and sets auth cookies", async () => {
    const res = await request(app).post("/api/v1/auth/google").send({ idToken: "google-id-token" });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(profile.email);
    expect(res.body.data.user.role).toBe("customer");
    // Google has already proven ownership of the address, so no verification
    // email step stands between sign-up and placing an order.
    expect(res.body.data.user.isEmailVerified).toBe(true);
    expect(res.body.data.accessToken).toEqual(expect.any(String));

    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((c) => c.startsWith("accessToken="))).toBe(true);
    expect(cookies.some((c) => c.startsWith("refreshToken="))).toBe(true);
  });

  it("signs an existing user in instead of creating a duplicate account", async () => {
    const first = await request(app).post("/api/v1/auth/google").send({ idToken: "google-id-token" });
    const second = await request(app).post("/api/v1/auth/google").send({ idToken: "google-id-token" });

    expect(second.status).toBe(200);
    expect(second.body.data.user.id).toBe(first.body.data.user.id);
    expect(await UserModel.countDocuments({ email: profile.email })).toBe(1);
  });

  it("signs in an account that was created with email/password, keeping its own name and role", async () => {
    await request(app).post("/api/v1/auth/register").send({
      name: "Password User",
      email: profile.email,
      password: "Password123",
      confirmPassword: "Password123",
    });

    const res = await request(app).post("/api/v1/auth/google").send({ idToken: "google-id-token" });

    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe("Password User");
    expect(await UserModel.countDocuments({ email: profile.email })).toBe(1);

    // The existing password must keep working — Google sign-in adds a way in,
    // it never replaces the credentials already on the account.
    const passwordLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: profile.email, password: "Password123" });
    expect(passwordLogin.status).toBe(200);
  });

  it("refuses a deactivated account", async () => {
    await request(app).post("/api/v1/auth/google").send({ idToken: "google-id-token" });
    await UserModel.updateOne({ email: profile.email }, { isActive: false });

    const res = await request(app).post("/api/v1/auth/google").send({ idToken: "google-id-token" });
    expect(res.status).toBe(403);
  });

  it("rejects a request with no idToken before reaching Google", async () => {
    const res = await request(app).post("/api/v1/auth/google").send({});

    expect(res.status).toBe(400);
    expect(verifyGoogleIdToken).not.toHaveBeenCalled();
  });
});

import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { UserModel } from "../../models/User.model";
import { CategoryModel } from "../../models/Category.model";
import { ProductModel } from "../../models/Product.model";
import { signEmailVerificationToken } from "../../utils/jwt";
import { env } from "../../config/env";

const app = createApp();

async function seedProduct() {
  const category = await CategoryModel.create({ name: "Dates", slug: "dates" });
  return ProductModel.create({
    name: "Ajwa Dates",
    slug: "ajwa-dates",
    tagline: "Rich, soft Madinah dates",
    description: "Premium Ajwa dates.",
    origin: "Madinah",
    categories: [category._id],
    variants: [{ label: "500g", priceBDT: 1000, stock: 5, lowStockThreshold: 2 }],
  });
}

describe("Email verification integration", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("registers a customer as unverified, without signing them in", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      name: "Jane Customer",
      email: "jane@example.com",
      password: "Password123",
      confirmPassword: "Password123",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.requiresOtpVerification).toBe(true);
    expect(res.body.data.email).toBe("jane@example.com");

    // No session yet — register only creates the account and emails a code;
    // it doesn't set auth cookies or return a usable user/token.
    const cookies = (res.headers["set-cookie"] as unknown as string[]) ?? [];
    expect(cookies.some((c) => c.startsWith("accessToken="))).toBe(false);

    const stored = await UserModel.findOne({ email: "jane@example.com" });
    expect(stored?.isEmailVerified).toBe(false);
  });

  it("verifies registration with the emailed OTP and signs the account in, then blocks reuse of a stale code", async () => {
    const register = await request(app).post("/api/v1/auth/register").send({
      name: "Jane Otp",
      email: "jane.otp@example.com",
      password: "Password123",
      confirmPassword: "Password123",
    });
    expect(register.status).toBe(201);

    const dbUser = await UserModel.findOne({ email: "jane.otp@example.com" }).select("+emailVerificationOtp");
    const otp = dbUser!.emailVerificationOtp!;
    expect(otp).toMatch(/^\d{6}$/);

    const wrongCode = await request(app)
      .post("/api/v1/auth/verify-registration-otp")
      .send({ email: "jane.otp@example.com", code: otp === "000000" ? "111111" : "000000" });
    expect(wrongCode.status).toBe(400);

    const verified = await request(app)
      .post("/api/v1/auth/verify-registration-otp")
      .send({ email: "jane.otp@example.com", code: otp });
    expect(verified.status).toBe(200);
    expect(verified.body.data.user.isEmailVerified).toBe(true);
    const cookies = verified.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((c) => c.startsWith("accessToken="))).toBe(true);

    // The code is single-use — the same (now-cleared) code can't be replayed.
    const replay = await request(app)
      .post("/api/v1/auth/verify-registration-otp")
      .send({ email: "jane.otp@example.com", code: otp });
    expect(replay.status).toBe(200);
    expect(replay.body.data.user.isEmailVerified).toBe(true); // already-verified short-circuit, not a re-check
  });

  it("invalidates the registration OTP after too many wrong attempts, and resend issues a fresh one", async () => {
    await request(app).post("/api/v1/auth/register").send({
      name: "Jane Attempts",
      email: "jane.attempts@example.com",
      password: "Password123",
      confirmPassword: "Password123",
    });

    for (let i = 0; i < 5; i += 1) {
      const attempt = await request(app)
        .post("/api/v1/auth/verify-registration-otp")
        .send({ email: "jane.attempts@example.com", code: "999999" });
      expect(attempt.status).toBe(400);
    }

    const afterLockout = await UserModel.findOne({ email: "jane.attempts@example.com" }).select(
      "+emailVerificationOtp"
    );
    expect(afterLockout?.emailVerificationOtp).toBeUndefined();

    const resend = await request(app)
      .post("/api/v1/auth/resend-registration-otp")
      .send({ email: "jane.attempts@example.com" });
    expect(resend.status).toBe(200);

    const afterResend = await UserModel.findOne({ email: "jane.attempts@example.com" }).select(
      "+emailVerificationOtp"
    );
    const freshOtp = afterResend!.emailVerificationOtp!;
    expect(freshOtp).toMatch(/^\d{6}$/);

    const verified = await request(app)
      .post("/api/v1/auth/verify-registration-otp")
      .send({ email: "jane.attempts@example.com", code: freshOtp });
    expect(verified.status).toBe(200);
  });

  it("verifies with a valid token, then reports 'already-verified' on a second use", async () => {
    const user = await UserModel.create({
      name: "Jane Customer",
      email: "jane2@example.com",
      password: "Password123",
      role: "customer",
      isEmailVerified: false,
    });
    const token = signEmailVerificationToken(user._id.toString());

    const first = await request(app).post("/api/v1/auth/verify-email").send({ token });
    expect(first.status).toBe(200);
    expect(first.body.data.status).toBe("verified");

    const updated = await UserModel.findById(user._id);
    expect(updated?.isEmailVerified).toBe(true);

    const second = await request(app).post("/api/v1/auth/verify-email").send({ token });
    expect(second.status).toBe(200);
    expect(second.body.data.status).toBe("already-verified");
  });

  it("rejects a malformed token as invalid, and an expired token as expired", async () => {
    const invalid = await request(app)
      .post("/api/v1/auth/verify-email")
      .send({ token: "not-a-real-token" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.message.toLowerCase()).toContain("invalid");

    const user = await UserModel.create({
      name: "Jane Customer",
      email: "jane3@example.com",
      password: "Password123",
      role: "customer",
      isEmailVerified: false,
    });
    const expiredToken = jwt.sign(
      { sub: user._id.toString(), purpose: "email_verification" },
      env.JWT_ACCESS_SECRET,
      { expiresIn: "-10s" }
    );
    const expired = await request(app).post("/api/v1/auth/verify-email").send({ token: expiredToken });
    expect(expired.status).toBe(400);
    expect(expired.body.message.toLowerCase()).toContain("expired");
  });

  it("resend-verification always responds with a generic success, whether or not the email exists", async () => {
    const unknown = await request(app)
      .post("/api/v1/auth/resend-verification")
      .send({ email: "nobody@example.com" });
    expect(unknown.status).toBe(200);

    const user = await UserModel.create({
      name: "Jane Customer",
      email: "jane4@example.com",
      password: "Password123",
      role: "customer",
      isEmailVerified: false,
    });
    const known = await request(app)
      .post("/api/v1/auth/resend-verification")
      .send({ email: user.email });
    expect(known.status).toBe(200);
  });

  it("blocks an unverified customer from creating an order or a review, and allows it once verified", async () => {
    const { token, user } = await createAuthedUser({ role: "customer", isEmailVerified: false });
    const product = await seedProduct();
    const variantId = product.variants[0]!._id!.toString();

    const orderAttempt = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(token))
      .send({
        items: [{ productId: product._id.toString(), variantId, quantity: 1 }],
        shippingAddress: {
          firstName: "Jane",
          lastName: "Doe",
          email: "jane.doe@example.com",
          phone: "+8801812345678",
          fullAddress: "House 1, Road 2",
          district: "Dhaka",
          cityArea: "Gulshan",
        },
        deliveryMethod: "standard",
        paymentMethod: "cod",
      });
    expect(orderAttempt.status).toBe(403);

    const reviewAttempt = await request(app)
      .post(`/api/v1/reviews/product/${product._id.toString()}`)
      .set(...authHeader(token))
      .send({ rating: 5, comment: "Great dates!" });
    expect(reviewAttempt.status).toBe(403);

    await UserModel.findByIdAndUpdate(user._id, { isEmailVerified: true });

    const orderRetry = await request(app)
      .post("/api/v1/orders")
      .set(...authHeader(token))
      .send({
        items: [{ productId: product._id.toString(), variantId, quantity: 1 }],
        shippingAddress: {
          firstName: "Jane",
          lastName: "Doe",
          email: "jane.doe@example.com",
          phone: "+8801812345678",
          fullAddress: "House 1, Road 2",
          district: "Dhaka",
          cityArea: "Gulshan",
        },
        deliveryMethod: "standard",
        paymentMethod: "cod",
      });
    expect(orderRetry.status).toBe(201);
  });
});

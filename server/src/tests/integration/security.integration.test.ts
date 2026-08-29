import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { UserModel } from "../../models/User.model";
import { MAX_FAILED_LOGIN_ATTEMPTS, STAFF_INACTIVITY_TIMEOUT_MS } from "../../constants/security";

const app = createApp();

describe("Security hardening (lockout, inactivity, impersonation)", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe("account lockout", () => {
    it("locks an account after too many failed password attempts and lets an admin unlock it", async () => {
      const email = "lockme@example.com";
      await createAuthedUser({ email, password: "Password123", role: "customer" });
      const { token: adminToken, user: admin } = await createAuthedUser({ role: "admin" });

      for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS - 1; i += 1) {
        const res = await request(app).post("/api/v1/auth/login").send({ email, password: "WrongPass1" });
        expect(res.status).toBe(401);
      }

      const locking = await request(app).post("/api/v1/auth/login").send({ email, password: "WrongPass1" });
      expect(locking.status).toBe(403);
      expect(locking.body.message).toMatch(/locked/i);

      // Even the correct password is refused while the lock stands.
      const whileLocked = await request(app).post("/api/v1/auth/login").send({ email, password: "Password123" });
      expect(whileLocked.status).toBe(403);

      const target = await UserModel.findOne({ email });
      const unlock = await request(app)
        .patch(`/api/v1/users/${target!._id.toString()}/unlock`)
        .set(...authHeader(adminToken))
        .send({});
      expect(unlock.status).toBe(200);

      const afterUnlock = await request(app).post("/api/v1/auth/login").send({ email, password: "Password123" });
      expect(afterUnlock.status).toBe(200);
      expect(afterUnlock.body.data.user.email).toBe(email);
      void admin;
    });

    it("clears the failed-attempt counter on a successful login", async () => {
      const email = "resetcount@example.com";
      await createAuthedUser({ email, password: "Password123", role: "customer" });

      await request(app).post("/api/v1/auth/login").send({ email, password: "WrongPass1" });
      await request(app).post("/api/v1/auth/login").send({ email, password: "WrongPass1" });
      await request(app).post("/api/v1/auth/login").send({ email, password: "Password123" });

      const user = await UserModel.findOne({ email });
      expect(user?.failedLoginAttempts).toBe(0);
      expect(user?.lockedUntil).toBeUndefined();
    });
  });

  describe("staff inactivity timeout", () => {
    it("signs an idle staff session out but leaves an idle customer session alone", async () => {
      const { token: staffToken, user: staff } = await createAuthedUser({ role: "co_admin" });
      const { token: customerToken, user: customer } = await createAuthedUser({ role: "customer" });

      const idleSince = new Date(Date.now() - STAFF_INACTIVITY_TIMEOUT_MS - 60_000);
      await UserModel.updateOne({ _id: staff._id }, { lastSeenAt: idleSince });
      await UserModel.updateOne({ _id: customer._id }, { lastSeenAt: idleSince });

      const staffRes = await request(app)
        .get("/api/v1/auth/me")
        .set(...authHeader(staffToken));
      expect(staffRes.status).toBe(401);
      expect(staffRes.body.message).toMatch(/inactivity/i);

      const customerRes = await request(app)
        .get("/api/v1/auth/me")
        .set(...authHeader(customerToken));
      expect(customerRes.status).toBe(200);
    });

    it("keeps an active staff session alive and refreshes lastSeenAt", async () => {
      const { token, user } = await createAuthedUser({ role: "admin" });
      await UserModel.updateOne({ _id: user._id }, { lastSeenAt: new Date(Date.now() - 5 * 60_000) });

      const res = await request(app)
        .get("/api/v1/auth/me")
        .set(...authHeader(token));
      expect(res.status).toBe(200);

      const after = await UserModel.findById(user._id);
      expect(Date.now() - after!.lastSeenAt!.getTime()).toBeLessThan(10_000);
    });
  });

  describe("impersonation (support-login)", () => {
    it("lets a super admin act as a customer, stamping the session with who started it", async () => {
      const { token: superToken, user: superAdmin } = await createAuthedUser({ role: "super_admin" });
      const { user: target } = await createAuthedUser({ role: "customer", email: "target@example.com" });

      const res = await request(app)
        .post(`/api/v1/users/${target._id.toString()}/impersonate`)
        .set(...authHeader(superToken))
        .send({});
      expect(res.status).toBe(200);
      const impersonationToken = res.body.data.accessToken as string;

      const me = await request(app)
        .get("/api/v1/auth/me")
        .set(...authHeader(impersonationToken));
      expect(me.status).toBe(200);
      expect(me.body.data.user.email).toBe("target@example.com");
      expect(me.body.data.impersonatedBy).toBe(superAdmin._id.toString());

      // The Super Admin's own session is untouched.
      const stillSuper = await request(app)
        .get("/api/v1/auth/me")
        .set(...authHeader(superToken));
      expect(stillSuper.body.data.user.role).toBe("super_admin");
      expect(stillSuper.body.data.impersonatedBy).toBeUndefined();
    });

    it("refuses to impersonate another super admin, and refuses non-super-admin callers", async () => {
      const { token: superToken } = await createAuthedUser({ role: "super_admin" });
      const { user: otherSuper } = await createAuthedUser({ role: "super_admin" });
      const { token: adminToken } = await createAuthedUser({ role: "admin" });
      const { user: customer } = await createAuthedUser({ role: "customer" });

      const peer = await request(app)
        .post(`/api/v1/users/${otherSuper._id.toString()}/impersonate`)
        .set(...authHeader(superToken))
        .send({});
      expect(peer.status).toBe(403);

      const byAdmin = await request(app)
        .post(`/api/v1/users/${customer._id.toString()}/impersonate`)
        .set(...authHeader(adminToken))
        .send({});
      expect(byAdmin.status).toBe(403);
    });
  });
});

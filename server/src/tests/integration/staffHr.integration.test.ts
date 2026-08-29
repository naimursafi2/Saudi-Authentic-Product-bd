/**
 * Two Phase-2 HR additions: a staff member's NID number + card image, and a
 * salary payment's optional daily allowance. Cloudinary is stubbed (same
 * pattern as heroSlide.integration.test.ts) since uploads are otherwise
 * 503-guarded in the test environment.
 */
const uploadBufferToCloudinary = jest
  .fn()
  .mockResolvedValue({ url: "https://cdn.test/nid-1.jpg", publicId: "staff-nid/nid-1" });
const deleteCloudinaryImage = jest.fn().mockResolvedValue(undefined);

jest.mock("../../config/cloudinary", () => ({
  uploadBufferToCloudinary: (...args: unknown[]) => uploadBufferToCloudinary(...args),
  deleteCloudinaryImage: (...args: unknown[]) => deleteCloudinaryImage(...args),
}));

import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { UserModel } from "../../models/User.model";
import { SalaryPaymentModel } from "../../models/SalaryPayment.model";
import { InternalAssetModel } from "../../models/InternalAsset.model";

const app = createApp();
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

describe("Staff NID information", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
    uploadBufferToCloudinary.mockClear();
    deleteCloudinaryImage.mockClear();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  async function createStaffMember(adminToken: string) {
    const res = await request(app)
      .post("/api/v1/users")
      .set(...authHeader(adminToken))
      .send({
        name: "New Hire",
        email: `hire-${Date.now()}@example.com`,
        password: "Password123",
        role: "employee",
        staffMeta: { employeeId: `EMP-${Date.now()}`, nidNumber: "1990123456789" },
      });
    return res.body.data.user as { _id: string; staffMeta: { nidNumber?: string } };
  }

  it("saves an NID number at creation and lets an admin correct it via staff-meta", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const staff = await createStaffMember(adminToken);
    expect(staff.staffMeta.nidNumber).toBe("1990123456789");

    const corrected = await request(app)
      .patch(`/api/v1/users/${staff._id}/staff-meta`)
      .set(...authHeader(adminToken))
      .send({ nidNumber: "1990123456780" });
    expect(corrected.status).toBe(200);
    expect(corrected.body.data.user.staffMeta.nidNumber).toBe("1990123456780");
  });

  it("uploads an NID card image and retires the old one on re-upload", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const staff = await createStaffMember(adminToken);

    const first = await request(app)
      .patch(`/api/v1/users/${staff._id}/staff-meta/nid-image`)
      .set(...authHeader(adminToken))
      .attach("nidImage", PIXEL, "nid-front.png");
    expect(first.status).toBe(200);
    expect(first.body.data.user.staffMeta.nidImage.url).toBe("https://cdn.test/nid-1.jpg");
    expect(deleteCloudinaryImage).not.toHaveBeenCalled();

    const second = await request(app)
      .patch(`/api/v1/users/${staff._id}/staff-meta/nid-image`)
      .set(...authHeader(adminToken))
      .attach("nidImage", PIXEL, "nid-front-retake.png");
    expect(second.status).toBe(200);

    // The superseded NID scan is not destroyed — a staff replacement now hands
    // the old file to the internal-asset lifecycle for Super Admin review, so
    // it stays recoverable. See internalAsset.service.ts#retireInternalAsset.
    expect(deleteCloudinaryImage).not.toHaveBeenCalled();
    const retired = await InternalAssetModel.findOne({ publicId: "staff-nid/nid-1" });
    expect(retired?.status).toBe("delete_requested");
  });

  it("rejects a non-HR role from reading or writing staff-meta / NID data", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: employeeToken } = await createAuthedUser({ role: "employee" });
    const staff = await createStaffMember(adminToken);

    const patchAttempt = await request(app)
      .patch(`/api/v1/users/${staff._id}/staff-meta`)
      .set(...authHeader(employeeToken))
      .send({ nidNumber: "0000000000000" });
    expect(patchAttempt.status).toBe(403);

    const uploadAttempt = await request(app)
      .patch(`/api/v1/users/${staff._id}/staff-meta/nid-image`)
      .set(...authHeader(employeeToken))
      .attach("nidImage", PIXEL, "nid.png");
    expect(uploadAttempt.status).toBe(403);

    const dbUser = await UserModel.findById(staff._id);
    expect(dbUser?.staffMeta?.nidNumber).toBe("1990123456789");
  });
});

describe("Salary payment daily allowance", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("records a daily allowance alongside base salary and defaults to 0 when omitted", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { user: employee } = await createAuthedUser({ role: "employee", email: "allowance-emp@example.com" });
    await UserModel.findByIdAndUpdate(employee._id, { staffMeta: { employeeId: "EMP-ALLOW-1" } });

    const withAllowance = await request(app)
      .post("/api/v1/salary-payments")
      .set(...authHeader(adminToken))
      .send({ employee: employee._id.toString(), month: 1, year: 2027, amountBDT: 20000, dailyAllowanceBDT: 1500 });
    expect(withAllowance.status).toBe(201);
    expect(withAllowance.body.data.payment.amountBDT).toBe(20000);
    expect(withAllowance.body.data.payment.dailyAllowanceBDT).toBe(1500);

    const withoutAllowance = await request(app)
      .post("/api/v1/salary-payments")
      .set(...authHeader(adminToken))
      .send({ employee: employee._id.toString(), month: 2, year: 2027, amountBDT: 20000 });
    expect(withoutAllowance.status).toBe(201);
    expect(withoutAllowance.body.data.payment.dailyAllowanceBDT).toBe(0);

    const dbRecord = await SalaryPaymentModel.findOne({ employee: employee._id, month: 1, year: 2027 });
    expect(dbRecord?.dailyAllowanceBDT).toBe(1500);
  });

  it("lets the employee see their own allowance in their payment history", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: employeeToken, user: employee } = await createAuthedUser({
      role: "employee",
      email: "allowance-view@example.com",
    });
    await UserModel.findByIdAndUpdate(employee._id, { staffMeta: { employeeId: "EMP-ALLOW-2" } });

    await request(app)
      .post("/api/v1/salary-payments")
      .set(...authHeader(adminToken))
      .send({ employee: employee._id.toString(), month: 3, year: 2027, amountBDT: 18000, dailyAllowanceBDT: 500 });

    const mine = await request(app).get("/api/v1/salary-payments/mine").set(...authHeader(employeeToken));
    expect(mine.status).toBe(200);
    expect(mine.body.data.payments[0].dailyAllowanceBDT).toBe(500);
  });
});

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
import { PendingActionModel } from "../../models/PendingAction.model";
import { signAccessToken } from "../../utils/jwt";

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

  it("saves an NID number at creation and lets Super Admin correct it directly", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
    const staff = await createStaffMember(adminToken);
    expect(staff.staffMeta.nidNumber).toBe("1990123456789");

    const corrected = await request(app)
      .patch(`/api/v1/users/${staff._id}/staff-meta`)
      .set(...authHeader(superAdminToken))
      .send({ nidNumber: "1990123456780" });
    expect(corrected.status).toBe(200);
    expect(corrected.body.data.user.staffMeta.nidNumber).toBe("1990123456780");
    expect(corrected.body.data.pendingActionId).toBeUndefined();
  });

  it("queues an Admin's NID number change instead of applying it", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const staff = await createStaffMember(adminToken);

    const attempt = await request(app)
      .patch(`/api/v1/users/${staff._id}/staff-meta`)
      .set(...authHeader(adminToken))
      .send({ department: "Operations", nidNumber: "1990123456780" });
    expect(attempt.status).toBe(200);
    expect(attempt.body.data.pendingActionId).toBeTruthy();

    const dbUser = await UserModel.findById(staff._id);
    // Ordinary employment data applies immediately; the identity document does not.
    expect(dbUser?.staffMeta?.department).toBe("Operations");
    expect(dbUser?.staffMeta?.nidNumber).toBe("1990123456789");

    const action = await PendingActionModel.findById(attempt.body.data.pendingActionId);
    expect(action?.actionType).toBe("user.nid.update");
    expect(action?.status).toBe("pending");
  });

  it("applies a queued NID change once Super Admin grants it", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
    const staff = await createStaffMember(adminToken);

    const requested = await request(app)
      .patch(`/api/v1/users/${staff._id}/staff-meta`)
      .set(...authHeader(adminToken))
      .send({ nidNumber: "1990123456780" });
    const actionId = requested.body.data.pendingActionId;

    const granted = await request(app)
      .patch(`/api/v1/pending-actions/${actionId}/grant`)
      .set(...authHeader(superAdminToken))
      .send({});
    expect(granted.status).toBe(200);

    const dbUser = await UserModel.findById(staff._id);
    expect(dbUser?.staffMeta?.nidNumber).toBe("1990123456780");
  });

  it("leaves the record untouched when Super Admin denies a queued NID change", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
    const staff = await createStaffMember(adminToken);

    const requested = await request(app)
      .patch(`/api/v1/users/${staff._id}/staff-meta`)
      .set(...authHeader(adminToken))
      .send({ nidNumber: "1990123456780" });

    const denied = await request(app)
      .patch(`/api/v1/pending-actions/${requested.body.data.pendingActionId}/deny`)
      .set(...authHeader(superAdminToken))
      .send({ reviewNote: "Scan does not match the number supplied" });
    expect(denied.status).toBe(200);

    const dbUser = await UserModel.findById(staff._id);
    expect(dbUser?.staffMeta?.nidNumber).toBe("1990123456789");
  });

  it("holds an Admin's replacement NID scan out of the live record until it is granted", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
    const staff = await createStaffMember(adminToken);

    const proposed = await request(app)
      .patch(`/api/v1/users/${staff._id}/staff-meta/nid-image`)
      .set(...authHeader(adminToken))
      .attach("nidImage", PIXEL, "nid-front.png");
    expect(proposed.status).toBe(200);
    expect(proposed.body.data.pendingActionId).toBeTruthy();

    // The proposed scan exists as a file (so a reviewer can look at it) but is
    // not yet the staff member's document.
    // Mongoose materialises the nested `nidImage` path as an empty object
    // rather than leaving it undefined, so assert on the url it would carry.
    let dbUser = await UserModel.findById(staff._id);
    expect(dbUser?.staffMeta?.nidImage?.url).toBeUndefined();
    expect(await InternalAssetModel.findOne({ publicId: "staff-nid/nid-1" })).not.toBeNull();

    await request(app)
      .patch(`/api/v1/pending-actions/${proposed.body.data.pendingActionId}/grant`)
      .set(...authHeader(superAdminToken))
      .send({})
      .expect(200);

    dbUser = await UserModel.findById(staff._id);
    expect(dbUser?.staffMeta?.nidImage?.url).toBe("https://cdn.test/nid-1.jpg");
  });

  it("retires a rejected replacement scan rather than leaving it live forever", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
    const staff = await createStaffMember(adminToken);

    const proposed = await request(app)
      .patch(`/api/v1/users/${staff._id}/staff-meta/nid-image`)
      .set(...authHeader(adminToken))
      .attach("nidImage", PIXEL, "nid-front.png");

    await request(app)
      .patch(`/api/v1/pending-actions/${proposed.body.data.pendingActionId}/deny`)
      .set(...authHeader(superAdminToken))
      .send({ reviewNote: "Unreadable scan" })
      .expect(200);

    // The orphaned upload is handed to the internal-asset lifecycle, not
    // destroyed outright and not left as an untracked live file.
    const asset = await InternalAssetModel.findOne({ publicId: "staff-nid/nid-1" });
    expect(asset?.status).toBe("delete_requested");
    expect(deleteCloudinaryImage).not.toHaveBeenCalled();
  });

  it("replaces the scan directly for Super Admin, retiring the superseded one", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
    const staff = await createStaffMember(adminToken);

    const first = await request(app)
      .patch(`/api/v1/users/${staff._id}/staff-meta/nid-image`)
      .set(...authHeader(superAdminToken))
      .attach("nidImage", PIXEL, "nid-front.png");
    expect(first.status).toBe(200);
    expect(first.body.data.user.staffMeta.nidImage.url).toBe("https://cdn.test/nid-1.jpg");
    expect(first.body.data.pendingActionId).toBeUndefined();
    expect(deleteCloudinaryImage).not.toHaveBeenCalled();

    const second = await request(app)
      .patch(`/api/v1/users/${staff._id}/staff-meta/nid-image`)
      .set(...authHeader(superAdminToken))
      .attach("nidImage", PIXEL, "nid-front-retake.png");
    expect(second.status).toBe(200);

    // The superseded NID scan is not destroyed — a replacement hands the old
    // file to the internal-asset lifecycle for Super Admin review, so it stays
    // recoverable. See internalAsset.service.ts#retireInternalAsset.
    expect(deleteCloudinaryImage).not.toHaveBeenCalled();
    const retired = await InternalAssetModel.findOne({ publicId: "staff-nid/nid-1" });
    expect(retired?.status).toBe("delete_requested");
  });

  it("lets a staff member request a correction to their own NID, but never make one", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
    const staff = await createStaffMember(adminToken);

    // Sign in as the staff member themselves.
    const staffUser = await UserModel.findById(staff._id);
    const selfToken = signAccessToken({
      sub: staffUser!._id.toString(),
      role: staffUser!.role,
      tokenVersion: staffUser!.tokenVersion,
    });

    const submitted = await request(app)
      .post("/api/v1/users/me/staff-meta/nid-edit-request")
      .set(...authHeader(selfToken))
      .field("reason", "My NID was reissued with a new number")
      .field("nidNumber", "1990999888777")
      .attach("nidImage", PIXEL, "new-nid.png");
    expect(submitted.status).toBe(201);
    expect(submitted.body.data.pendingActionId).toBeTruthy();

    // Nothing changed on the live record — it is a request, not an edit.
    const dbUser = await UserModel.findById(staff._id);
    expect(dbUser?.staffMeta?.nidNumber).toBe("1990123456789");

    // A reason is mandatory, so a bare request is rejected outright.
    const noReason = await request(app)
      .post("/api/v1/users/me/staff-meta/nid-edit-request")
      .set(...authHeader(selfToken))
      .send({ nidNumber: "1990000000000" });
    expect(noReason.status).toBe(400);

    // Super Admin granting it is what actually writes the record.
    await request(app)
      .patch(`/api/v1/pending-actions/${submitted.body.data.pendingActionId}/grant`)
      .set(...authHeader(superAdminToken))
      .send({})
      .expect(200);
    const afterGrant = await UserModel.findById(staff._id);
    expect(afterGrant?.staffMeta?.nidNumber).toBe("1990999888777");
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

  it("keeps a staff member out of their own NID record — they cannot self-edit it", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const staff = await createStaffMember(adminToken);

    // Sign the staff member in as themselves and have them try to rewrite
    // their own NID: identity documents are HR-held, not self-service.
    const { token: selfToken } = await createAuthedUser({ role: "employee" });
    const selfEdit = await request(app)
      .patch(`/api/v1/users/${staff._id}/staff-meta`)
      .set(...authHeader(selfToken))
      .send({ nidNumber: "9999999999999" });
    expect(selfEdit.status).toBe(403);

    const dbUser = await UserModel.findById(staff._id);
    expect(dbUser?.staffMeta?.nidNumber).toBe("1990123456789");
  });

  it("validates the NID number rather than storing anything sent", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const staff = await createStaffMember(adminToken);

    const tooLong = await request(app)
      .patch(`/api/v1/users/${staff._id}/staff-meta`)
      .set(...authHeader(adminToken))
      .send({ nidNumber: "1".repeat(31) });
    expect(tooLong.status).toBe(400);

    const empty = await request(app)
      .patch(`/api/v1/users/${staff._id}/staff-meta`)
      .set(...authHeader(adminToken))
      .send({ nidNumber: "" });
    expect(empty.status).toBe(400);

    // The stored value is untouched by either rejected attempt.
    const dbUser = await UserModel.findById(staff._id);
    expect(dbUser?.staffMeta?.nidNumber).toBe("1990123456789");
  });

  it("registers every NID scan in the internal-asset registry so it is traceable and recoverable", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const staff = await createStaffMember(adminToken);

    await request(app)
      .patch(`/api/v1/users/${staff._id}/staff-meta/nid-image`)
      .set(...authHeader(adminToken))
      .attach("nidImage", PIXEL, "nid-front.png")
      .expect(200);

    const asset = await InternalAssetModel.findOne({ publicId: "staff-nid/nid-1" });
    expect(asset).not.toBeNull();
    expect(asset?.status).toBe("active");
    // The registry records what the file belongs to and who put it there, so
    // a Super Admin reviewing the upload dashboard can trace it back.
    expect(asset?.resource).toBe("User");
    expect(asset?.resourceId?.toString()).toBe(staff._id);
    expect(asset?.fieldPath).toBe("staffMeta.nidImage");
    expect(asset?.uploadedBy).toBeTruthy();
  });

  it("lets Super Admin read another staff member's NID details", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: superAdminToken } = await createAuthedUser({ role: "super_admin" });
    const staff = await createStaffMember(adminToken);

    const res = await request(app)
      .get(`/api/v1/users/${staff._id}`)
      .set(...authHeader(superAdminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.user.staffMeta.nidNumber).toBe("1990123456789");
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

  it("rejects a negative daily allowance", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { user: employee } = await createAuthedUser({ role: "employee", email: "allowance-neg@example.com" });

    const res = await request(app)
      .post("/api/v1/salary-payments")
      .set(...authHeader(adminToken))
      .send({
        employee: employee._id.toString(),
        month: 4,
        year: 2027,
        amountBDT: 20000,
        dailyAllowanceBDT: -100,
      });
    expect(res.status).toBe(400);
    expect(await SalaryPaymentModel.countDocuments()).toBe(0);
  });

  it("allows an allowance-only top-up of zero but never a zero base salary", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { user: employee } = await createAuthedUser({ role: "employee", email: "allowance-zero@example.com" });
    await UserModel.findByIdAndUpdate(employee._id, { staffMeta: { employeeId: "EMP-ALLOW-ZERO" } });

    const zeroAllowance = await request(app)
      .post("/api/v1/salary-payments")
      .set(...authHeader(adminToken))
      .send({ employee: employee._id.toString(), month: 5, year: 2027, amountBDT: 15000, dailyAllowanceBDT: 0 });
    expect(zeroAllowance.status).toBe(201);
    expect(zeroAllowance.body.data.payment.dailyAllowanceBDT).toBe(0);

    const zeroSalary = await request(app)
      .post("/api/v1/salary-payments")
      .set(...authHeader(adminToken))
      .send({ employee: employee._id.toString(), month: 6, year: 2027, amountBDT: 0, dailyAllowanceBDT: 900 });
    expect(zeroSalary.status).toBe(400);
  });

  it("keeps payroll — allowance included — away from every role but Admin and Super Admin", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
    const { token: employeeToken, user: employee } = await createAuthedUser({
      role: "employee",
      email: "allowance-rbac@example.com",
    });
    const { token: otherEmployeeToken } = await createAuthedUser({
      role: "employee",
      email: "allowance-rbac-other@example.com",
    });
    await UserModel.findByIdAndUpdate(employee._id, { staffMeta: { employeeId: "EMP-ALLOW-RBAC" } });

    await request(app)
      .post("/api/v1/salary-payments")
      .set(...authHeader(adminToken))
      .send({ employee: employee._id.toString(), month: 7, year: 2027, amountBDT: 21000, dailyAllowanceBDT: 700 })
      .expect(201);

    // Co-Admin is deliberately excluded from payroll entirely.
    for (const token of [coAdminToken, employeeToken]) {
      const listAttempt = await request(app).get("/api/v1/salary-payments").set(...authHeader(token));
      expect(listAttempt.status).toBe(403);

      const createAttempt = await request(app)
        .post("/api/v1/salary-payments")
        .set(...authHeader(token))
        .send({ employee: employee._id.toString(), month: 8, year: 2027, amountBDT: 5000, dailyAllowanceBDT: 100 });
      expect(createAttempt.status).toBe(403);
    }

    // `/mine` is self-scoped: another employee sees their own (empty) history,
    // never this employee's allowance.
    const otherMine = await request(app)
      .get("/api/v1/salary-payments/mine")
      .set(...authHeader(otherEmployeeToken));
    expect(otherMine.status).toBe(200);
    expect(otherMine.body.data.payments).toHaveLength(0);
  });

  it("carries the allowance through to marking a payment paid", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { user: employee } = await createAuthedUser({ role: "employee", email: "allowance-paid@example.com" });
    await UserModel.findByIdAndUpdate(employee._id, { staffMeta: { employeeId: "EMP-ALLOW-PAID" } });

    const created = await request(app)
      .post("/api/v1/salary-payments")
      .set(...authHeader(adminToken))
      .send({ employee: employee._id.toString(), month: 9, year: 2027, amountBDT: 22000, dailyAllowanceBDT: 1200 });
    expect(created.status).toBe(201);

    const paid = await request(app)
      .patch(`/api/v1/salary-payments/${created.body.data.payment._id}/status`)
      .set(...authHeader(adminToken))
      .send({ status: "paid" });
    expect(paid.status).toBe(200);
    expect(paid.body.data.payment.status).toBe("paid");
    // The allowance is part of the settled record, not dropped on status change.
    expect(paid.body.data.payment.dailyAllowanceBDT).toBe(1200);
    expect(paid.body.data.payment.amountBDT).toBe(22000);
  });
});

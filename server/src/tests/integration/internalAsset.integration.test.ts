/**
 * Cloudinary is stubbed so the lifecycle can be exercised without a network
 * call, and so the "permanent deletion failed" path can be triggered on demand
 * — the one branch that cannot be reached against a healthy Cloudinary.
 */
const uploadBufferToCloudinary = jest.fn();
const deleteCloudinaryImage = jest.fn();

jest.mock("../../config/cloudinary", () => ({
  uploadBufferToCloudinary: (...args: unknown[]) => uploadBufferToCloudinary(...args),
  deleteCloudinaryImage: (...args: unknown[]) => deleteCloudinaryImage(...args),
  isCloudinaryConfigured: true,
}));

import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { InternalAssetModel, RECYCLE_BIN_RETENTION_DAYS } from "../../models/InternalAsset.model";
import { AuditLogModel } from "../../models/AuditLog.model";
import { ExpenseModel } from "../../models/Expense.model";
import {
  recordInternalAsset,
  retireInternalAsset,
  uploadInternalFile,
} from "../../services/internalAsset.service";
import { runAssetPurgeTick } from "../../services/scheduler.service";
import type { Role } from "../../constants/roles";

const app = createApp();

function fakeFile(name = "memo.pdf", mime = "application/pdf"): Express.Multer.File {
  return {
    fieldname: "file",
    originalname: name,
    encoding: "7bit",
    mimetype: mime,
    size: 2048,
    buffer: Buffer.from("x"),
    destination: "",
    filename: name,
    path: "",
    stream: undefined as never,
  };
}

async function seedAsset(opts: { role: Role; publicId?: string; resource?: string; module?: string }) {
  const { user, token } = await createAuthedUser({ role: opts.role });
  const asset = await recordInternalAsset({
    publicId: opts.publicId ?? `pid-${Math.random().toString(36).slice(2)}`,
    url: "https://cdn.test/file.pdf",
    resource: opts.resource ?? "Purchase",
    resourceId: "0123456789abcdef01234567",
    fieldPath: "costItems.proof",
    module: opts.module ?? "Purchases",
    fileName: "memo.pdf",
    mimeType: "application/pdf",
    actor: { id: user._id.toString(), role: opts.role },
  });
  return { user, token, asset: asset! };
}

describe("Internal upload management & recycle bin", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  beforeEach(() => {
    uploadBufferToCloudinary.mockResolvedValue({ url: "https://cdn.test/f.pdf", publicId: "cloud-1" });
    deleteCloudinaryImage.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  // -- 1. Upload tracking --

  it("tracks an upload from every internal role", async () => {
    const roles: Role[] = ["employee", "delivery_agent", "order_manager", "co_admin", "admin", "super_admin"];
    for (const role of roles) {
      const { asset } = await seedAsset({ role, publicId: `pid-${role}` });
      expect(asset.uploadedByRole).toBe(role);
      expect(asset.status).toBe("active");
    }
    expect(await InternalAssetModel.countDocuments()).toBe(roles.length);
  });

  it("never tracks a customer's upload", async () => {
    const { user } = await createAuthedUser({ role: "customer" });
    const recorded = await recordInternalAsset({
      publicId: "customer-review-photo",
      url: "https://cdn.test/review.jpg",
      resource: "Review",
      actor: { id: user._id.toString(), role: "customer" },
    });

    expect(recorded).toBeNull();
    expect(await InternalAssetModel.countDocuments()).toBe(0);
  });

  it("records file metadata and derives a kind through the shared upload helper", async () => {
    const { user } = await createAuthedUser({ role: "co_admin" });

    await uploadInternalFile(fakeFile("scan.png", "image/png"), {
      folder: "test",
      resource: "Expense",
      module: "Expenses",
      actor: { id: user._id.toString(), role: "co_admin" },
    });

    const asset = await InternalAssetModel.findOne({ publicId: "cloud-1" });
    expect(asset?.fileName).toBe("scan.png");
    expect(asset?.kind).toBe("image");
    expect(asset?.bytes).toBe(2048);
    expect(asset?.module).toBe("Expenses");
  });

  it("is idempotent — registering the same file twice makes one row", async () => {
    const { user } = await createAuthedUser({ role: "admin" });
    const actor = { id: user._id.toString(), role: "admin" as Role };
    const input = { publicId: "same", url: "u", resource: "Product", actor };

    await recordInternalAsset(input);
    await recordInternalAsset(input);

    expect(await InternalAssetModel.countDocuments({ publicId: "same" })).toBe(1);
  });

  // -- 2. Super Admin centralized visibility --

  it("shows Super Admin every upload, with search and filters", async () => {
    await seedAsset({ role: "employee", publicId: "a", module: "Expenses" });
    await seedAsset({ role: "co_admin", publicId: "b", resource: "Product", module: "Catalog" });
    const { token } = await createAuthedUser({ role: "super_admin" });

    const all = await request(app).get("/api/v1/internal-assets").set(...authHeader(token));
    expect(all.status).toBe(200);
    expect(all.body.data.assets).toHaveLength(2);

    const byRole = await request(app)
      .get("/api/v1/internal-assets?role=co_admin")
      .set(...authHeader(token));
    expect(byRole.body.data.assets).toHaveLength(1);
    expect(byRole.body.data.assets[0].uploadedByRole).toBe("co_admin");

    const byModule = await request(app)
      .get("/api/v1/internal-assets?module=Expenses")
      .set(...authHeader(token));
    expect(byModule.body.data.assets).toHaveLength(1);

    const byResource = await request(app)
      .get("/api/v1/internal-assets?resource=Product")
      .set(...authHeader(token));
    expect(byResource.body.data.assets).toHaveLength(1);
  });

  // -- 7. Role restrictions --

  it("keeps the dashboard and every review action Super Admin only", async () => {
    const { asset } = await seedAsset({ role: "employee" });
    const id = asset._id.toString();

    for (const role of ["employee", "order_manager", "co_admin", "admin"] as Role[]) {
      const { token } = await createAuthedUser({ role });
      expect((await request(app).get("/api/v1/internal-assets").set(...authHeader(token))).status).toBe(403);
      expect(
        (await request(app).patch(`/api/v1/internal-assets/${id}/approve`).set(...authHeader(token))).status
      ).toBe(403);
      expect(
        (await request(app).patch(`/api/v1/internal-assets/${id}/restore`).set(...authHeader(token))).status
      ).toBe(403);
      expect(
        (await request(app).patch(`/api/v1/internal-assets/${id}/recycle`).set(...authHeader(token))).status
      ).toBe(403);
      expect(
        (
          await request(app)
            .post(`/api/v1/internal-assets/${id}/purge`)
            .set(...authHeader(token))
            .send({ confirm: true })
        ).status
      ).toBe(403);
    }
    expect((await request(app).get("/api/v1/internal-assets")).status).toBe(401);
  });

  it("lets a staff member request deletion only for their own upload", async () => {
    const { asset } = await seedAsset({ role: "employee" });
    const { token: otherToken } = await createAuthedUser({ role: "co_admin" });

    const foreign = await request(app)
      .post(`/api/v1/internal-assets/${asset._id.toString()}/request-delete`)
      .set(...authHeader(otherToken))
      .send({ reason: "not mine" });
    expect(foreign.status).toBe(403);
    expect((await InternalAssetModel.findById(asset._id))?.status).toBe("active");
  });

  // -- 2/3. Delete request flow --

  it("creates a delete request that leaves the file active and untouched", async () => {
    const { asset } = await seedAsset({ role: "employee" });
    // Super Admin holds `assets.manage`, so it may raise the request on the
    // uploader's behalf; the own-file restriction is covered separately above.
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });

    const res = await request(app)
      .post(`/api/v1/internal-assets/${asset._id.toString()}/request-delete`)
      .set(...authHeader(superToken))
      .send({ reason: "Uploaded by mistake" });

    expect(res.status).toBe(200);
    const stored = await InternalAssetModel.findById(asset._id);
    expect(stored?.status).toBe("delete_requested");
    expect(stored?.deleteReason).toBe("Uploaded by mistake");
    // Crucially, nothing was removed from Cloudinary.
    expect(deleteCloudinaryImage).not.toHaveBeenCalled();

    const log = await AuditLogModel.findOne({ action: "internalAsset.delete.request" });
    expect(log).not.toBeNull();
  });

  it("rejects a request and leaves the file active", async () => {
    const { asset } = await seedAsset({ role: "admin" });
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });
    const id = asset._id.toString();

    await request(app)
      .post(`/api/v1/internal-assets/${id}/request-delete`)
      .set(...authHeader(superToken))
      .send({});

    const res = await request(app)
      .patch(`/api/v1/internal-assets/${id}/reject`)
      .set(...authHeader(superToken))
      .send({ reviewNote: "Still needed" });

    expect(res.status).toBe(200);
    const stored = await InternalAssetModel.findById(id);
    expect(stored?.status).toBe("active");
    expect(stored?.reviewNote).toBe("Still needed");
    expect(deleteCloudinaryImage).not.toHaveBeenCalled();
    expect(await AuditLogModel.countDocuments({ action: "internalAsset.delete.reject" })).toBe(1);
  });

  // -- 3. Recycle Bin --

  it("approves a request into the Recycle Bin with a 15-day window, keeping the file", async () => {
    const { asset } = await seedAsset({ role: "co_admin" });
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });
    const id = asset._id.toString();

    await request(app)
      .post(`/api/v1/internal-assets/${id}/request-delete`)
      .set(...authHeader(superToken))
      .send({});
    const res = await request(app)
      .patch(`/api/v1/internal-assets/${id}/approve`)
      .set(...authHeader(superToken))
      .send({ reviewNote: "Approved" });

    expect(res.status).toBe(200);
    const stored = await InternalAssetModel.findById(id);
    expect(stored?.status).toBe("recycled");
    expect(stored?.recycledAt).toBeTruthy();

    const days = Math.round(
      (stored!.purgeAfter!.getTime() - stored!.recycledAt!.getTime()) / (24 * 60 * 60 * 1000)
    );
    expect(days).toBe(RECYCLE_BIN_RETENTION_DAYS);
    // The Cloudinary file survives approval — that is what makes restore free.
    expect(deleteCloudinaryImage).not.toHaveBeenCalled();
  });

  it("lets only Super Admin directly recycle an active file and records the action", async () => {
    const { asset } = await seedAsset({ role: "employee", publicId: "direct-recycle" });
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });
    const id = asset._id.toString();

    const res = await request(app)
      .patch(`/api/v1/internal-assets/${id}/recycle`)
      .set(...authHeader(superToken))
      .send({ reason: "No longer required" });

    expect(res.status).toBe(200);
    const stored = await InternalAssetModel.findById(id);
    expect(stored?.status).toBe("recycled");
    expect(stored?.recycledAt).toBeTruthy();
    expect(stored?.history.at(-1)?.action).toBe("recycled");
    expect(deleteCloudinaryImage).not.toHaveBeenCalled();
    expect(await AuditLogModel.countDocuments({ action: "internalAsset.recycle.direct" })).toBe(1);
  });

  it("completely removes permanently deleted files from employee, Co-Admin and Super Admin asset lists", async () => {
    const { asset, token: ownerToken } = await seedAsset({ role: "employee" });
    const { asset: coAdminAsset, token: coAdminToken } = await seedAsset({ role: "co_admin" });
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });
    const id = asset._id.toString();
    const coAdminId = coAdminAsset._id.toString();

    await request(app).patch(`/api/v1/internal-assets/${id}/recycle`).set(...authHeader(superToken)).send({});
    await request(app).patch(`/api/v1/internal-assets/${coAdminId}/recycle`).set(...authHeader(superToken)).send({});
    await request(app)
      .post(`/api/v1/internal-assets/${id}/purge`)
      .set(...authHeader(superToken))
      .send({ confirm: true });
    await request(app)
      .post(`/api/v1/internal-assets/${coAdminId}/purge`)
      .set(...authHeader(superToken))
      .send({ confirm: true });

    const superAdminDefault = await request(app).get("/api/v1/internal-assets").set(...authHeader(superToken));
    expect(superAdminDefault.body.data.assets.map((item: { _id: string }) => item._id)).not.toContain(id);
    expect(superAdminDefault.body.data.assets.map((item: { _id: string }) => item._id)).not.toContain(coAdminId);

    const staffDefault = await request(app).get("/api/v1/internal-assets/mine").set(...authHeader(ownerToken));
    expect(staffDefault.body.data.assets.map((item: { _id: string }) => item._id)).not.toContain(id);
    const coAdminDefault = await request(app).get("/api/v1/internal-assets/mine").set(...authHeader(coAdminToken));
    expect(coAdminDefault.body.data.assets.map((item: { _id: string }) => item._id)).not.toContain(coAdminId);

    expect(await InternalAssetModel.findById(id)).toBeNull();
    expect(await InternalAssetModel.findById(coAdminId)).toBeNull();
    expect(deleteCloudinaryImage).toHaveBeenCalledWith(asset.publicId);
    expect(deleteCloudinaryImage).toHaveBeenCalledWith(coAdminAsset.publicId);
  });

  it("removes a permanently deleted cash memo from its Expense record for every role, including legacy uploads without resourceId", async () => {
    const { user: coAdmin, token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });
    const expense = await ExpenseModel.create({
      category: "shipping",
      amountBDT: 222,
      incurredAt: new Date("2026-08-29T00:00:00.000Z"),
      reason: "Receipt must disappear after permanent deletion",
      cashMemo: { url: "https://cdn.test/expense-memo.jpg", publicId: "expense-memo" },
      status: "pending",
      recordedBy: coAdmin._id,
      recordedByRole: "co_admin",
    });
    // This is intentionally missing resourceId: it represents the existing
    // rows created before an Expense's id was linked after upload.
    const asset = await recordInternalAsset({
      publicId: "expense-memo",
      url: "https://cdn.test/expense-memo.jpg",
      resource: "Expense",
      fieldPath: "cashMemo",
      module: "Expenses",
      actor: { id: coAdmin._id.toString(), role: "co_admin" },
    });

    await request(app)
      .patch(`/api/v1/internal-assets/${asset!._id.toString()}/recycle`)
      .set(...authHeader(superToken))
      .send({});
    const purge = await request(app)
      .post(`/api/v1/internal-assets/${asset!._id.toString()}/purge`)
      .set(...authHeader(superToken))
      .send({ confirm: true });

    expect(purge.status).toBe(200);
    expect(await InternalAssetModel.findById(asset!._id)).toBeNull();
    expect((await ExpenseModel.findById(expense._id))?.cashMemo).toBeUndefined();

    const coAdminList = await request(app)
      .get("/api/v1/expenses?month=2026-08")
      .set(...authHeader(coAdminToken));
    expect(coAdminList.status).toBe(200);
    expect(coAdminList.body.data.expenses).toHaveLength(1);
    expect(coAdminList.body.data.expenses[0].cashMemo).toBeUndefined();
  });

  // -- 4. Restore --

  it("restores a recycled file, reusing the original Cloudinary object", async () => {
    const { asset } = await seedAsset({ role: "employee", publicId: "keep-me" });
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });
    const id = asset._id.toString();

    await request(app).post(`/api/v1/internal-assets/${id}/request-delete`).set(...authHeader(superToken)).send({});
    await request(app).patch(`/api/v1/internal-assets/${id}/approve`).set(...authHeader(superToken)).send({});

    const res = await request(app)
      .patch(`/api/v1/internal-assets/${id}/restore`)
      .set(...authHeader(superToken));

    expect(res.status).toBe(200);
    const stored = await InternalAssetModel.findById(id);
    expect(stored?.status).toBe("active");
    expect(stored?.purgeAfter).toBeUndefined();
    expect(stored?.deleteRequestedAt).toBeUndefined();
    // Same file, no re-upload.
    expect(stored?.publicId).toBe("keep-me");
    expect(uploadBufferToCloudinary).not.toHaveBeenCalled();
    expect(await AuditLogModel.countDocuments({ action: "internalAsset.restore" })).toBe(1);
  });

  it("refuses to restore something that was never recycled", async () => {
    const { asset } = await seedAsset({ role: "admin" });
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });

    const res = await request(app)
      .patch(`/api/v1/internal-assets/${asset._id.toString()}/restore`)
      .set(...authHeader(superToken));
    expect(res.status).toBe(400);
  });

  // -- 5. Automatic expiry --

  it("permanently deletes expired items on the scheduler tick, and not before", async () => {
    const { asset } = await seedAsset({ role: "employee", publicId: "expired" });
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });
    const id = asset._id.toString();

    await request(app).post(`/api/v1/internal-assets/${id}/request-delete`).set(...authHeader(superToken)).send({});
    await request(app).patch(`/api/v1/internal-assets/${id}/approve`).set(...authHeader(superToken)).send({});

    // Still inside the window: the sweep leaves it alone.
    await runAssetPurgeTick();
    expect((await InternalAssetModel.findById(id))?.status).toBe("recycled");
    expect(deleteCloudinaryImage).not.toHaveBeenCalled();

    // Age it past the retention window.
    await InternalAssetModel.updateOne({ _id: id }, { $set: { purgeAfter: new Date(Date.now() - 1000) } });
    await runAssetPurgeTick();

    expect(await InternalAssetModel.findById(id)).toBeNull();
    expect(deleteCloudinaryImage).toHaveBeenCalledWith("expired");
  });

  it("cannot restore a file after it has been permanently deleted", async () => {
    const { asset } = await seedAsset({ role: "employee" });
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });
    const id = asset._id.toString();

    await request(app).post(`/api/v1/internal-assets/${id}/request-delete`).set(...authHeader(superToken)).send({});
    await request(app).patch(`/api/v1/internal-assets/${id}/approve`).set(...authHeader(superToken)).send({});
    await InternalAssetModel.updateOne({ _id: id }, { $set: { purgeAfter: new Date(Date.now() - 1000) } });
    await runAssetPurgeTick();

    const res = await request(app)
      .patch(`/api/v1/internal-assets/${id}/restore`)
      .set(...authHeader(superToken));
    expect(res.status).toBe(404);
    expect(await InternalAssetModel.findById(id)).toBeNull();
  });

  // -- Failure handling --

  it("keeps sweeping when one Cloudinary cleanup fails, and retries it later", async () => {
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });
    const first = (await seedAsset({ role: "employee", publicId: "bad" })).asset;
    const second = (await seedAsset({ role: "employee", publicId: "good" })).asset;

    for (const a of [first, second]) {
      const id = a._id.toString();
      await request(app).post(`/api/v1/internal-assets/${id}/request-delete`).set(...authHeader(superToken)).send({});
      await request(app).patch(`/api/v1/internal-assets/${id}/approve`).set(...authHeader(superToken)).send({});
      await InternalAssetModel.updateOne({ _id: id }, { $set: { purgeAfter: new Date(Date.now() - 1000) } });
    }

    deleteCloudinaryImage.mockImplementation((publicId: string) =>
      publicId === "bad" ? Promise.reject(new Error("cloudinary down")) : Promise.resolve(undefined)
    );

    await runAssetPurgeTick();

    // The failure is contained and recorded, never silently dropped.
    const bad = await InternalAssetModel.findOne({ publicId: "bad" });
    expect(bad?.status).toBe("recycled");
    expect(bad?.purgeAttempts).toBe(1);
    expect(bad?.purgeError).toMatch(/cloudinary down/i);

    expect(await InternalAssetModel.findOne({ publicId: "good" })).toBeNull();

    // Next sweep retries the failed one once storage recovers.
    deleteCloudinaryImage.mockResolvedValue(undefined);
    await runAssetPurgeTick();
    expect(await InternalAssetModel.findOne({ publicId: "bad" })).toBeNull();
  });

  // -- 6. Immediate permanent deletion --

  it("lets Super Admin purge immediately, but only with explicit confirmation", async () => {
    const { asset } = await seedAsset({ role: "admin", publicId: "now" });
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });
    const id = asset._id.toString();

    await request(app).post(`/api/v1/internal-assets/${id}/request-delete`).set(...authHeader(superToken)).send({});
    await request(app).patch(`/api/v1/internal-assets/${id}/approve`).set(...authHeader(superToken)).send({});

    // Without confirmation the API refuses outright.
    const unconfirmed = await request(app)
      .post(`/api/v1/internal-assets/${id}/purge`)
      .set(...authHeader(superToken))
      .send({});
    expect(unconfirmed.status).toBe(400);
    expect((await InternalAssetModel.findById(id))?.status).toBe("recycled");
    expect(deleteCloudinaryImage).not.toHaveBeenCalled();

    const res = await request(app)
      .post(`/api/v1/internal-assets/${id}/purge`)
      .set(...authHeader(superToken))
      .send({ confirm: true });

    expect(res.status).toBe(200);
    expect(await InternalAssetModel.findById(id)).toBeNull();
    expect(deleteCloudinaryImage).toHaveBeenCalledWith("now");
    expect(await AuditLogModel.countDocuments({ action: "internalAsset.purge" })).toBe(1);
  });

  it("refuses immediate purge for a file that is still active", async () => {
    const { asset } = await seedAsset({ role: "admin" });
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });

    const res = await request(app)
      .post(`/api/v1/internal-assets/${asset._id.toString()}/purge`)
      .set(...authHeader(superToken))
      .send({ confirm: true });

    expect(res.status).toBe(400);
    expect(deleteCloudinaryImage).not.toHaveBeenCalled();
  });

  // -- Retire helper: what existing services now call instead of deleting --

  it("turns a staff removal into a delete request rather than destroying the file", async () => {
    const { user, asset } = await seedAsset({ role: "co_admin", publicId: "retire-me" });

    await retireInternalAsset("retire-me", { id: user._id.toString(), role: "co_admin" }, "Replaced");

    const stored = await InternalAssetModel.findById(asset._id);
    expect(stored?.status).toBe("delete_requested");
    expect(stored?.deleteReason).toBe("Replaced");
    expect(deleteCloudinaryImage).not.toHaveBeenCalled();
  });

  it("still deletes immediately for untracked files, preserving existing behaviour", async () => {
    const { user } = await createAuthedUser({ role: "customer" });

    await retireInternalAsset("legacy-file", { id: user._id.toString(), role: "customer" });

    expect(deleteCloudinaryImage).toHaveBeenCalledWith("legacy-file");
  });
});

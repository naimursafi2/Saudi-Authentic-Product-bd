import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { ExpenseModel } from "../../models/Expense.model";
import { AuditLogModel } from "../../models/AuditLog.model";

const app = createApp();

async function seedConfirmedExpense(recordedById: string, recordedByRole = "admin") {
  return ExpenseModel.create({
    category: "packaging",
    amountBDT: 3000,
    incurredAt: new Date("2026-08-18T00:00:00Z"),
    reason: "Boxes for August batch",
    status: "confirmed",
    recordedBy: recordedById,
    recordedByRole,
    confirmedBy: recordedById,
    confirmedAt: new Date(),
  });
}

describe("Expense edit requests & monthly archive", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe("monthly archive", () => {
    it("groups expenses by month, newest first, with an accurate total per month", async () => {
      const { user: admin, token } = await createAuthedUser({ role: "admin" });
      await ExpenseModel.create([
        {
          category: "packaging",
          amountBDT: 1000,
          incurredAt: new Date("2026-07-10"),
          reason: "July box order",
          status: "confirmed",
          recordedBy: admin._id,
          recordedByRole: "admin",
        },
        {
          category: "other",
          amountBDT: 3000,
          otherCategoryDetail: "Signage",
          incurredAt: new Date("2026-08-18"),
          reason: "August signage",
          status: "confirmed",
          recordedBy: admin._id,
          recordedByRole: "admin",
        },
        {
          category: "other",
          amountBDT: 1010,
          otherCategoryDetail: "Misc",
          incurredAt: new Date("2026-08-27"),
          reason: "August misc",
          status: "confirmed",
          recordedBy: admin._id,
          recordedByRole: "admin",
        },
      ]);

      const res = await request(app).get("/api/v1/expenses/months").set(...authHeader(token));
      expect(res.status).toBe(200);
      expect(res.body.data.months).toEqual([
        { month: "2026-08", totalBDT: 4010, count: 2 },
        { month: "2026-07", totalBDT: 1000, count: 1 },
      ]);

      const augustOnly = await request(app)
        .get("/api/v1/expenses?month=2026-08")
        .set(...authHeader(token));
      expect(augustOnly.status).toBe(200);
      expect(augustOnly.body.data.expenses).toHaveLength(2);
    });

    it("scopes a co_admin's monthly archive to their own submissions, but lets an employee see everything (read-only)", async () => {
      const { user: admin, token: adminToken } = await createAuthedUser({ role: "admin" });
      await seedConfirmedExpense(admin._id.toString());

      const { user: coAdmin, token: coToken } = await createAuthedUser({ role: "co_admin" });
      await ExpenseModel.create({
        category: "marketing",
        amountBDT: 500,
        incurredAt: new Date("2026-08-05"),
        reason: "Co-admin's own expense",
        status: "pending",
        recordedBy: coAdmin._id,
        recordedByRole: "co_admin",
      });

      const coAdminMonths = await request(app).get("/api/v1/expenses/months").set(...authHeader(coToken));
      expect(coAdminMonths.body.data.months).toEqual([{ month: "2026-08", totalBDT: 500, count: 1 }]);

      const { token: employeeToken } = await createAuthedUser({ role: "employee" });
      const employeeList = await request(app).get("/api/v1/expenses").set(...authHeader(employeeToken));
      expect(employeeList.status).toBe(200);
      expect(employeeList.body.data.expenses).toHaveLength(2);

      // Employee still cannot submit a new expense directly.
      const employeeCreate = await request(app)
        .post("/api/v1/expenses")
        .set(...authHeader(employeeToken))
        .field("category", "other")
        .field("otherCategoryDetail", "test")
        .field("amountBDT", "10")
        .field("reason", "test");
      expect(employeeCreate.status).toBe(403);

      void adminToken;
    });
  });

  describe("direct edit & delete (Super Admin only)", () => {
    it("lets a super_admin directly edit a confirmed expense, recording the field-level diff on the audit log", async () => {
      const { user: admin } = await createAuthedUser({ role: "admin" });
      const expense = await seedConfirmedExpense(admin._id.toString());
      const { token: superToken } = await createAuthedUser({ role: "super_admin" });

      const res = await request(app)
        .patch(`/api/v1/expenses/${expense._id.toString()}`)
        .set(...authHeader(superToken))
        .send({ amountBDT: 3500, reason: "Corrected boxes cost" });

      expect(res.status).toBe(200);
      expect(res.body.data.expense.amountBDT).toBe(3500);
      expect(res.body.data.expense.reason).toBe("Corrected boxes cost");
      expect(res.body.data.expense.lastEditViaRequest).toBe(false);
      expect(res.body.data.expense.lastEditedAt).toBeTruthy();

      const log = await AuditLogModel.findOne({ action: "expense.edit", resourceId: expense._id.toString() });
      expect(log).not.toBeNull();
      expect((log!.oldValue as Record<string, unknown>).amountBDT).toBe(3000);
      expect((log!.newValue as Record<string, unknown>).amountBDT).toBe(3500);
    });

    it("rejects a direct edit or delete from an admin, co_admin, or employee — only super_admin holds expenses.edit", async () => {
      const { user: superAdmin, token: superToken } = await createAuthedUser({ role: "super_admin" });
      const expense = await seedConfirmedExpense(superAdmin._id.toString(), "super_admin");

      const { token: adminToken } = await createAuthedUser({ role: "admin" });
      const { token: coToken } = await createAuthedUser({ role: "co_admin" });
      const { token: employeeToken } = await createAuthedUser({ role: "employee" });

      for (const token of [adminToken, coToken, employeeToken]) {
        const edit = await request(app)
          .patch(`/api/v1/expenses/${expense._id.toString()}`)
          .set(...authHeader(token))
          .send({ amountBDT: 999 });
        expect(edit.status).toBe(403);

        const del = await request(app)
          .delete(`/api/v1/expenses/${expense._id.toString()}`)
          .set(...authHeader(token));
        expect(del.status).toBe(403);
      }

      const del = await request(app)
        .delete(`/api/v1/expenses/${expense._id.toString()}`)
        .set(...authHeader(superToken));
      expect(del.status).toBe(200);
      expect(await ExpenseModel.findById(expense._id)).toBeNull();
    });
  });

  describe("edit requests, reviewed exclusively by Super Admin", () => {
    it("routes an employee's edit request through the pending-action queue and applies it only once a super_admin grants it", async () => {
      const { user: admin } = await createAuthedUser({ role: "admin" });
      const expense = await seedConfirmedExpense(admin._id.toString());
      const { token: employeeToken } = await createAuthedUser({ role: "employee" });

      const requested = await request(app)
        .post(`/api/v1/expenses/${expense._id.toString()}/edit-request`)
        .set(...authHeader(employeeToken))
        .send({ changes: { amountBDT: 3200 }, reason: "Receipt shows a higher total" });

      expect(requested.status).toBe(202);
      expect(requested.body.data.pendingActionId).toBeDefined();

      // Nothing has changed yet.
      let reloaded = await ExpenseModel.findById(expense._id);
      expect(reloaded!.amountBDT).toBe(3000);

      // An admin cannot grant it either — only Super Admin reviews pending actions.
      const adminGrantAttempt = await request(app)
        .patch(`/api/v1/pending-actions/${requested.body.data.pendingActionId}/grant`)
        .set(...authHeader((await createAuthedUser({ role: "admin" })).token))
        .send({});
      expect(adminGrantAttempt.status).toBe(403);

      const { token: superToken } = await createAuthedUser({ role: "super_admin" });
      const granted = await request(app)
        .patch(`/api/v1/pending-actions/${requested.body.data.pendingActionId}/grant`)
        .set(...authHeader(superToken))
        .send({});
      expect(granted.status).toBe(200);

      reloaded = await ExpenseModel.findById(expense._id);
      expect(reloaded!.amountBDT).toBe(3200);
      expect(reloaded!.lastEditViaRequest).toBe(true);
      expect(reloaded!.lastEditedBy?.toString()).toBe((await ExpenseModel.findById(expense._id))!.lastEditedBy?.toString());

      const log = await AuditLogModel.findOne({ action: "expense.edit", resourceId: expense._id.toString() });
      expect((log!.newValue as Record<string, unknown>).amountBDT).toBe(3200);
    });

    it("leaves the expense untouched when a super_admin denies the edit request", async () => {
      const { user: admin } = await createAuthedUser({ role: "admin" });
      const expense = await seedConfirmedExpense(admin._id.toString());
      const { token: coToken } = await createAuthedUser({ role: "co_admin" });

      const requested = await request(app)
        .post(`/api/v1/expenses/${expense._id.toString()}/edit-request`)
        .set(...authHeader(coToken))
        .send({ changes: { category: "other", otherCategoryDetail: "Mislabeled" }, reason: "Wrong category" });
      expect(requested.status).toBe(202);

      const { token: superToken } = await createAuthedUser({ role: "super_admin" });
      const denied = await request(app)
        .patch(`/api/v1/pending-actions/${requested.body.data.pendingActionId}/deny`)
        .set(...authHeader(superToken))
        .send({ note: "Not necessary" });
      expect(denied.status).toBe(200);

      const reloaded = await ExpenseModel.findById(expense._id);
      expect(reloaded!.category).toBe("packaging");
      expect(reloaded!.lastEditedAt).toBeUndefined();
    });

    it("rejects an edit request that would leave category 'other' with no detail, both on direct submission and at grant time", async () => {
      const { user: admin } = await createAuthedUser({ role: "admin" });
      const expense = await seedConfirmedExpense(admin._id.toString());
      const { token: employeeToken } = await createAuthedUser({ role: "employee" });

      const badRequest = await request(app)
        .post(`/api/v1/expenses/${expense._id.toString()}/edit-request`)
        .set(...authHeader(employeeToken))
        .send({ changes: { category: "other" }, reason: "Change category" });
      expect(badRequest.status).toBe(400);
    });

    it("rejects a customer or anonymous caller outright", async () => {
      const { user: admin } = await createAuthedUser({ role: "admin" });
      const expense = await seedConfirmedExpense(admin._id.toString());
      const { token: customerToken } = await createAuthedUser({ role: "customer" });

      expect(
        (
          await request(app)
            .post(`/api/v1/expenses/${expense._id.toString()}/edit-request`)
            .set(...authHeader(customerToken))
            .send({ changes: { amountBDT: 1 }, reason: "x" })
        ).status
      ).toBe(403);

      expect(
        (await request(app).post(`/api/v1/expenses/${expense._id.toString()}/edit-request`).send({})).status
      ).toBe(401);
    });
  });
});

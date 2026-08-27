import request from "supertest";
import { createApp } from "../../app";
import { connectTestDb, clearTestDb, disconnectTestDb } from "./setup";
import { createAuthedUser, authHeader } from "./helpers";
import { CampaignModel } from "../../models/Campaign.model";
import { NotificationModel } from "../../models/Notification.model";
import { AuditLogModel } from "../../models/AuditLog.model";

// The dispatch pipeline calls `sendMail` directly (see
// campaign.service.ts#dispatchEmailChannel) so its success/failure per
// recipient can be tracked — mocked here so tests never touch a real SMTP
// server and can deterministically fail one recipient to exercise the
// failure-counting path.
const sendMailMock = jest.fn(async (opts: { to: string }) => {
  if (opts.to.includes("faildelivery")) throw new Error("Mailbox not found");
});
jest.mock("../../config/mailer", () => ({
  sendMail: (...args: [{ to: string; subject: string; html: string }]) => sendMailMock(...args),
}));

// Deterministic regardless of whatever SMS credentials happen to be in this
// machine's .env — the graceful-degrade ("SMS not configured") path is what
// the spec cares about most, and it's what a fresh/default install has.
jest.mock("../../config/env", () => ({
  ...jest.requireActual("../../config/env"),
  isSmsConfigured: false,
}));

import { dispatchCampaign, computeNextRun } from "../../services/campaign.service";

const app = createApp();

const baseSchedule = { type: "weekly" as const, dayOfWeek: 1, hour: 10, minute: 0 };

describe("Campaign management integration", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("blocks customers and employees from the campaign API entirely", async () => {
    const { token: customerToken } = await createAuthedUser({ role: "customer" });
    const { token: employeeToken } = await createAuthedUser({ role: "employee" });

    for (const token of [customerToken, employeeToken]) {
      const res = await request(app)
        .post("/api/v1/campaigns")
        .set(...authHeader(token))
        .send({
          title: "Eid Sale",
          message: "20% off everything",
          targetAudience: { type: "all" },
          channels: ["email"],
          schedule: baseSchedule,
        });
      expect(res.status).toBe(403);
    }
  });

  it("lets co_admin create/edit/submit a campaign, which requires Super Admin approval", async () => {
    const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
    await createAuthedUser({ role: "super_admin", email: "boss@example.com" });

    const create = await request(app)
      .post("/api/v1/campaigns")
      .set(...authHeader(coAdminToken))
      .send({
        title: "Eid Sale",
        message: "20% off everything",
        targetAudience: { type: "all" },
        channels: ["email"],
        schedule: baseSchedule,
      });
    expect(create.status).toBe(201);
    expect(create.body.data.campaign.status).toBe("draft");
    const id = create.body.data.campaign._id;

    // Co-Admin cannot approve/send/pause/delete — only create/edit/submit.
    const forbiddenApprove = await request(app)
      .patch(`/api/v1/campaigns/${id}/approve`)
      .set(...authHeader(coAdminToken))
      .send({});
    expect(forbiddenApprove.status).toBe(403);

    const edit = await request(app)
      .patch(`/api/v1/campaigns/${id}`)
      .set(...authHeader(coAdminToken))
      .send({ title: "Eid Mega Sale" });
    expect(edit.status).toBe(200);
    expect(edit.body.data.campaign.title).toBe("Eid Mega Sale");

    const submit = await request(app)
      .post(`/api/v1/campaigns/${id}/submit`)
      .set(...authHeader(coAdminToken))
      .send({});
    expect(submit.status).toBe(200);
    expect(submit.body.data.campaign.status).toBe("pending_approval");

    // Once submitted, it can no longer be edited directly.
    const editAfterSubmit = await request(app)
      .patch(`/api/v1/campaigns/${id}`)
      .set(...authHeader(coAdminToken))
      .send({ title: "Too late" });
    expect(editAfterSubmit.status).toBe(400);
  });

  it("lets Super Admin approve a pending campaign, scheduling it (no dispatch yet for a weekly schedule)", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });

    const create = await request(app)
      .post("/api/v1/campaigns")
      .set(...authHeader(adminToken))
      .send({
        title: "Weekly Digest",
        message: "New arrivals this week",
        targetAudience: { type: "all" },
        channels: ["email", "website"],
        schedule: baseSchedule,
      });
    const id = create.body.data.campaign._id;
    await request(app).post(`/api/v1/campaigns/${id}/submit`).set(...authHeader(adminToken)).send({});

    const approve = await request(app)
      .patch(`/api/v1/campaigns/${id}/approve`)
      .set(...authHeader(superToken))
      .send({ note: "Looks good" });
    expect(approve.status).toBe(200);
    expect(approve.body.data.campaign.status).toBe("scheduled");
    expect(approve.body.data.campaign.nextRunAt).toBeTruthy();

    const auditActions = (await AuditLogModel.find({ resource: "Campaign" })).map((l) => l.action);
    expect(auditActions).toEqual(expect.arrayContaining(["campaign.create", "campaign.submit", "campaign.approve"]));
  });

  it("lets Super Admin reject a pending campaign, and the creator can edit + resubmit it", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });

    const create = await request(app)
      .post("/api/v1/campaigns")
      .set(...authHeader(adminToken))
      .send({
        title: "Flash Sale",
        message: "Too aggressive a discount",
        targetAudience: { type: "all" },
        channels: ["email"],
        schedule: baseSchedule,
      });
    const id = create.body.data.campaign._id;
    await request(app).post(`/api/v1/campaigns/${id}/submit`).set(...authHeader(adminToken)).send({});

    const reject = await request(app)
      .patch(`/api/v1/campaigns/${id}/reject`)
      .set(...authHeader(superToken))
      .send({ note: "Discount too steep" });
    expect(reject.status).toBe(200);
    expect(reject.body.data.campaign.status).toBe("rejected");

    // Editing a rejected campaign brings it back to draft.
    const edit = await request(app)
      .patch(`/api/v1/campaigns/${id}`)
      .set(...authHeader(adminToken))
      .send({ message: "A gentler discount" });
    expect(edit.status).toBe(200);
    expect(edit.body.data.campaign.status).toBe("draft");

    const resubmit = await request(app).post(`/api/v1/campaigns/${id}/submit`).set(...authHeader(adminToken)).send({});
    expect(resubmit.status).toBe(200);
    expect(resubmit.body.data.campaign.status).toBe("pending_approval");
  });

  it("a super_admin's own campaign needs no approval and can be submitted directly", async () => {
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });

    const create = await request(app)
      .post("/api/v1/campaigns")
      .set(...authHeader(superToken))
      .send({
        title: "Founder's Note",
        message: "Straight from the top",
        targetAudience: { type: "all" },
        channels: ["email"],
        schedule: baseSchedule,
      });
    const id = create.body.data.campaign._id;

    const submit = await request(app).post(`/api/v1/campaigns/${id}/submit`).set(...authHeader(superToken)).send({});
    expect(submit.status).toBe(200);
    expect(submit.body.data.campaign.status).toBe("scheduled");
    expect(submit.body.data.campaign.approvalStatus).toBe("not_required");
  });

  it("scopes the campaign list to the caller's own campaigns unless they hold campaigns.approve", async () => {
    const { token: adminToken, user: adminUser } = await createAuthedUser({ role: "admin" });
    const { token: coAdminToken } = await createAuthedUser({ role: "co_admin" });
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });

    await request(app)
      .post("/api/v1/campaigns")
      .set(...authHeader(adminToken))
      .send({ title: "Admin's Campaign", message: "m", targetAudience: { type: "all" }, channels: ["email"], schedule: baseSchedule });
    await request(app)
      .post("/api/v1/campaigns")
      .set(...authHeader(coAdminToken))
      .send({ title: "Co-Admin's Campaign", message: "m", targetAudience: { type: "all" }, channels: ["email"], schedule: baseSchedule });

    const adminList = await request(app).get("/api/v1/campaigns").set(...authHeader(adminToken));
    expect(adminList.body.data.campaigns).toHaveLength(1);
    expect(adminList.body.data.campaigns[0].createdBy._id ?? adminList.body.data.campaigns[0].createdBy).toBe(adminUser._id.toString());

    const superList = await request(app).get("/api/v1/campaigns").set(...authHeader(superToken));
    expect(superList.body.data.campaigns).toHaveLength(2);
  });

  it("computes a live, dynamic recipient count and per-channel estimate", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const c1 = await createAuthedUser({ role: "customer", email: "c1@example.com" });
    await createAuthedUser({ role: "customer", email: "c2@example.com" });
    const inactive = await createAuthedUser({ role: "customer", email: "c3@example.com" });
    inactive.user.isActive = false;
    await inactive.user.save();
    c1.user.phone = "+8801700000000";
    await c1.user.save();

    const all = await request(app)
      .get("/api/v1/campaigns/audience-preview")
      .query({ type: "all" })
      .set(...authHeader(adminToken));
    expect(all.body.data.total).toBe(2); // the inactive customer is excluded
    expect(all.body.data.withEmail).toBe(2);
    expect(all.body.data.withPhone).toBe(1);

    const specific = await request(app)
      .get("/api/v1/campaigns/audience-preview")
      .query({ type: "specific", customerIds: c1.user._id.toString() })
      .set(...authHeader(adminToken));
    expect(specific.body.data.total).toBe(1);
  });

  it("reports the delivery channel status from real server configuration, not hardcoded", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const res = await request(app).get("/api/v1/campaigns/channel-status").set(...authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.website).toBe(true);
    expect(res.body.data.sms).toBe(false); // mocked isSmsConfigured: false
    expect(typeof res.body.data.email).toBe("boolean");
  });

  it("dispatches across email/sms/website, tracking per-recipient success and failure, gracefully skipping unconfigured SMS", async () => {
    const { user: adminUser } = await createAuthedUser({ role: "admin" });
    await createAuthedUser({ role: "customer", email: "ok1@example.com" });
    await createAuthedUser({ role: "customer", email: "faildelivery@example.com" });

    const campaign = await CampaignModel.create({
      title: "Test Blast",
      message: "Hello",
      targetAudience: { type: "all", customerIds: [] },
      channels: ["email", "sms", "website"],
      schedule: { type: "now" },
      status: "sending",
      createdBy: adminUser._id,
      createdByRole: "admin",
    });

    await dispatchCampaign(campaign._id.toString(), "manual", adminUser._id.toString());

    const updated = await CampaignModel.findById(campaign._id);
    expect(updated?.status).toBe("sent");
    expect(updated?.sendCount).toBe(1);
    expect(updated?.deliveries).toHaveLength(1);

    const [delivery] = updated!.deliveries;
    const emailResult = delivery.channelResults.find((r) => r.channel === "email")!;
    expect(emailResult.recipientCount).toBe(2);
    expect(emailResult.successCount).toBe(1);
    expect(emailResult.failureCount).toBe(1);
    expect(emailResult.failures[0].recipient).toContain("faildelivery");

    const smsResult = delivery.channelResults.find((r) => r.channel === "sms")!;
    expect(smsResult.status).toBe("skipped");
    expect(smsResult.skippedReason).toMatch(/not configured/i);

    const websiteResult = delivery.channelResults.find((r) => r.channel === "website")!;
    expect(websiteResult.successCount).toBe(2);

    const notifications = await NotificationModel.find({ campaign: campaign._id });
    expect(notifications).toHaveLength(2);
  });

  it("lets a customer read and mark-as-read the website notifications a campaign sent them", async () => {
    const { user: adminUser } = await createAuthedUser({ role: "admin" });
    const { token: customerToken, user: customer } = await createAuthedUser({ role: "customer" });

    const campaign = await CampaignModel.create({
      title: "Welcome Back",
      message: "We missed you",
      targetAudience: { type: "specific", customerIds: [customer._id] },
      channels: ["website"],
      schedule: { type: "now" },
      status: "sending",
      createdBy: adminUser._id,
      createdByRole: "admin",
    });
    await dispatchCampaign(campaign._id.toString(), "manual", adminUser._id.toString());

    const list = await request(app).get("/api/v1/notifications/mine").set(...authHeader(customerToken));
    expect(list.status).toBe(200);
    expect(list.body.data.notifications).toHaveLength(1);
    expect(list.body.data.unreadCount).toBe(1);
    const notificationId = list.body.data.notifications[0]._id;

    const markRead = await request(app)
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set(...authHeader(customerToken));
    expect(markRead.status).toBe(200);

    const afterRead = await request(app).get("/api/v1/notifications/mine").set(...authHeader(customerToken));
    expect(afterRead.body.data.unreadCount).toBe(0);
  });

  it("pauses and resumes a scheduled campaign, recomputing its next run on resume", async () => {
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });
    const create = await request(app)
      .post("/api/v1/campaigns")
      .set(...authHeader(superToken))
      .send({ title: "Recurring", message: "m", targetAudience: { type: "all" }, channels: ["email"], schedule: baseSchedule });
    const id = create.body.data.campaign._id;
    await request(app).post(`/api/v1/campaigns/${id}/submit`).set(...authHeader(superToken)).send({});

    const pause = await request(app).patch(`/api/v1/campaigns/${id}/pause`).set(...authHeader(superToken)).send({});
    expect(pause.status).toBe(200);
    expect(pause.body.data.campaign.status).toBe("paused");

    const resume = await request(app).patch(`/api/v1/campaigns/${id}/resume`).set(...authHeader(superToken)).send({});
    expect(resume.status).toBe(200);
    expect(resume.body.data.campaign.status).toBe("scheduled");
    expect(new Date(resume.body.data.campaign.nextRunAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("only Super Admin can delete a campaign", async () => {
    const { token: adminToken } = await createAuthedUser({ role: "admin" });
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });
    const create = await request(app)
      .post("/api/v1/campaigns")
      .set(...authHeader(adminToken))
      .send({ title: "Delete Me", message: "m", targetAudience: { type: "all" }, channels: ["email"], schedule: baseSchedule });
    const id = create.body.data.campaign._id;

    const forbidden = await request(app).delete(`/api/v1/campaigns/${id}`).set(...authHeader(adminToken));
    expect(forbidden.status).toBe(403);

    const allowed = await request(app).delete(`/api/v1/campaigns/${id}`).set(...authHeader(superToken));
    expect(allowed.status).toBe(200);
    expect(await CampaignModel.findById(id)).toBeNull();
  });

  it("computeNextRun rolls a weekly schedule forward to the correct next occurrence", () => {
    // Wednesday 2026-01-07 12:00 local time.
    const from = new Date(2026, 0, 7, 12, 0, 0);
    // Target: Monday (1) at 10:00 — the nearest Monday strictly after `from`.
    const next = computeNextRun({ type: "weekly", dayOfWeek: 1, hour: 10, minute: 0 }, from);
    expect(next.getDay()).toBe(1);
    expect(next.getHours()).toBe(10);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
  });

  it("computeNextRun clamps a monthly schedule to the last day of a shorter month", () => {
    // Day 31 in February should clamp to Feb 28 (2026 is not a leap year).
    const from = new Date(2026, 1, 1, 0, 0, 0); // Feb 1, 2026
    const next = computeNextRun({ type: "monthly", dayOfMonth: 31, hour: 9, minute: 0 }, from);
    expect(next.getMonth()).toBe(1);
    expect(next.getDate()).toBe(28);
  });

  it("rejects submitting/approving/etc when there is nothing to act on", async () => {
    const { token: superToken } = await createAuthedUser({ role: "super_admin" });
    const create = await request(app)
      .post("/api/v1/campaigns")
      .set(...authHeader(superToken))
      .send({ title: "Draft Only", message: "m", targetAudience: { type: "all" }, channels: ["email"], schedule: baseSchedule });
    const id = create.body.data.campaign._id;

    // Not pending_approval yet — approving a draft is rejected.
    const approve = await request(app).patch(`/api/v1/campaigns/${id}/approve`).set(...authHeader(superToken)).send({});
    expect(approve.status).toBe(400);

    // Not scheduled yet — pausing a draft is rejected.
    const pause = await request(app).patch(`/api/v1/campaigns/${id}/pause`).set(...authHeader(superToken)).send({});
    expect(pause.status).toBe(400);
  });
});

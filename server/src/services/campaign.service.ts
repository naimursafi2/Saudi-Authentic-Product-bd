import {
  CampaignModel,
  type ICampaign,
  type ICampaignChannelResult,
  type ICampaignSchedule,
  type CampaignChannel,
} from "../models/Campaign.model";
import { UserModel } from "../models/User.model";
import { ApiError } from "../utils/ApiError";
import { deleteCloudinaryImage, uploadBufferToCloudinary } from "../config/cloudinary";
import { sendMail } from "../config/mailer";
import { renderCampaignEmailHtml, sendCampaignSubmittedEmail, sendCampaignReviewedEmail } from "./email.service";
import { sendSms } from "../config/sms";
import { isSmsConfigured } from "../config/env";
import { createCampaignNotifications } from "./customerNotification.service";
import { recordAuditLog } from "./auditLog.service";
import type { CreateCampaignInput, UpdateCampaignInput } from "../validators/campaign.validator";
import type { Role } from "../constants/roles";

export interface CampaignActor {
  id: string;
  role: Role;
}

const CLOUDINARY_FOLDER = "saudi-authentic-product/campaigns";
/**
 * A bounded sample of failures, not one row per recipient — with a few
 * thousand recipients, storing every failure would make the campaign
 * document grow without bound. `failureCount` on the channel result is
 * always the true total even once this sample caps out.
 */
const FAILURE_SAMPLE_LIMIT = 25;
/** Cap on stored delivery history entries per campaign (a `$slice` on push) — plenty for a weekly/monthly campaign running for years. */
const DELIVERY_HISTORY_LIMIT = 200;
/** Emails are sent in small concurrent batches rather than all at once, so a large campaign doesn't open hundreds of simultaneous SMTP connections. */
const EMAIL_BATCH_SIZE = 20;

function isOwnerOrSuperAdmin(campaign: Pick<ICampaign, "createdBy">, actor: CampaignActor): boolean {
  return actor.role === "super_admin" || campaign.createdBy.toString() === actor.id;
}

// ---------------------------------------------------------------------------
// Audience resolution — always live against the current customer list, never
// a stored snapshot, so "1,250 recipients" is never stale (same reasoning as
// `computeCouponStatus()`/Purchase's cost virtuals elsewhere in this project).
// ---------------------------------------------------------------------------

function audienceFilter(targetAudience: { type: string; customerIds: unknown[] }): Record<string, unknown> {
  const base: Record<string, unknown> = { role: "customer", isActive: true };
  if (targetAudience.type === "all") return base;
  return { ...base, _id: { $in: targetAudience.customerIds } };
}

export async function getAudienceRecipients(targetAudience: ICampaign["targetAudience"]) {
  return UserModel.find(audienceFilter(targetAudience)).select("name email phone");
}

/** Backs the campaign form's live recipient count and per-channel estimate. */
export async function getAudiencePreview(targetAudience: { type: string; customerIds: unknown[] }) {
  const recipients = await UserModel.find(audienceFilter(targetAudience)).select("email phone");
  return {
    total: recipients.length,
    // Email is a required, always-present field on every User — so "with
    // email" is always the full total; kept explicit rather than assumed so
    // the UI never has to special-case it.
    withEmail: recipients.length,
    withPhone: recipients.filter((r) => Boolean(r.phone)).length,
  };
}

// ---------------------------------------------------------------------------
// Schedule math
// ---------------------------------------------------------------------------

function clampDayOfMonth(year: number, month0: number, day: number): number {
  const lastDayOfMonth = new Date(year, month0 + 1, 0).getDate();
  return Math.min(day, lastDayOfMonth);
}

/**
 * The next time a recurring/custom schedule should fire, strictly after
 * `from`. "weekly"/"monthly" roll forward indefinitely; "custom" is a single
 * fixed date; "now" has no next run (it dispatches immediately on activation
 * — see `activateCampaign`).
 */
export function computeNextRun(schedule: ICampaignSchedule, from: Date): Date {
  if (schedule.type === "custom") {
    return schedule.sendAt as Date;
  }

  const hour = schedule.hour ?? 0;
  const minute = schedule.minute ?? 0;

  if (schedule.type === "weekly") {
    const targetDay = schedule.dayOfWeek ?? 0;
    const candidate = new Date(from);
    candidate.setHours(hour, minute, 0, 0);
    let diffDays = (targetDay - candidate.getDay() + 7) % 7;
    if (diffDays === 0 && candidate <= from) diffDays = 7;
    candidate.setDate(candidate.getDate() + diffDays);
    return candidate;
  }

  // "monthly"
  const day = schedule.dayOfMonth ?? 1;
  let candidate = new Date(from.getFullYear(), from.getMonth(), clampDayOfMonth(from.getFullYear(), from.getMonth(), day), hour, minute, 0, 0);
  let guard = 0;
  while (candidate <= from && guard < 24) {
    const nextMonthIndex = candidate.getMonth() + 1;
    const year = candidate.getFullYear() + Math.floor(nextMonthIndex / 12);
    const month = nextMonthIndex % 12;
    candidate = new Date(year, month, clampDayOfMonth(year, month, day), hour, minute, 0, 0);
    guard++;
  }
  return candidate;
}

// ---------------------------------------------------------------------------
// CRUD + workflow
// ---------------------------------------------------------------------------

export async function listCampaigns(
  filter: { status?: string; search?: string; page: number; limit: number },
  viewer: CampaignActor
) {
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.search) query.title = { $regex: filter.search, $options: "i" };
  // Only Super Admin (the only role holding campaigns.approve) sees every
  // campaign — Admin/Co-Admin are scoped to their own, the same
  // "own submissions only" pattern Expenses and Audit Logs already use.
  if (viewer.role !== "super_admin") query.createdBy = viewer.id;

  const skip = (filter.page - 1) * filter.limit;
  const [campaigns, total] = await Promise.all([
    CampaignModel.find(query)
      .populate("createdBy", "name email")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filter.limit),
    CampaignModel.countDocuments(query),
  ]);

  return {
    campaigns,
    pagination: {
      page: filter.page,
      limit: filter.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filter.limit)),
    },
  };
}

export async function getCampaignById(id: string, viewer: CampaignActor): Promise<ICampaign> {
  const campaign = await CampaignModel.findById(id)
    .populate("createdBy", "name email")
    .populate("reviewedBy", "name email");
  if (!campaign) throw ApiError.notFound("Campaign not found");
  if (!isOwnerOrSuperAdmin(campaign, viewer)) {
    throw ApiError.forbidden("You do not have permission to view this campaign");
  }
  return campaign;
}

export async function createCampaign(
  input: CreateCampaignInput,
  actor: CampaignActor,
  file?: Express.Multer.File
): Promise<ICampaign> {
  const image = file ? await uploadBufferToCloudinary(file.buffer, { folder: CLOUDINARY_FOLDER }) : undefined;

  const campaign = await CampaignModel.create({
    title: input.title,
    message: input.message,
    image,
    targetAudience: input.targetAudience,
    channels: input.channels,
    schedule: input.schedule,
    status: "draft",
    approvalStatus: actor.role === "super_admin" ? "not_required" : "not_required",
    createdBy: actor.id,
    createdByRole: actor.role,
  });

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "campaign.create",
    resource: "Campaign",
    resourceId: campaign._id.toString(),
    newValue: { name: campaign.title },
  });

  return campaign;
}

function assertEditable(campaign: ICampaign) {
  if (campaign.status !== "draft" && campaign.status !== "rejected") {
    throw ApiError.badRequest(`A campaign can only be edited while it is a draft or rejected (currently "${campaign.status}")`);
  }
}

export async function updateCampaign(
  id: string,
  input: UpdateCampaignInput,
  actor: CampaignActor,
  file?: Express.Multer.File
): Promise<ICampaign> {
  const campaign = await CampaignModel.findById(id);
  if (!campaign) throw ApiError.notFound("Campaign not found");
  if (!isOwnerOrSuperAdmin(campaign, actor)) {
    throw ApiError.forbidden("You do not have permission to edit this campaign");
  }
  assertEditable(campaign);

  const oldValue = { title: campaign.title, status: campaign.status };

  if (file) {
    if (campaign.image?.publicId) await deleteCloudinaryImage(campaign.image.publicId);
    campaign.image = await uploadBufferToCloudinary(file.buffer, { folder: CLOUDINARY_FOLDER });
  } else if (input.removeImage && campaign.image?.publicId) {
    await deleteCloudinaryImage(campaign.image.publicId);
    campaign.image = undefined;
  }

  if (input.title !== undefined) campaign.title = input.title;
  if (input.message !== undefined) campaign.message = input.message;
  if (input.targetAudience !== undefined) {
    campaign.targetAudience = input.targetAudience as unknown as ICampaign["targetAudience"];
  }
  if (input.channels !== undefined) campaign.channels = input.channels as CampaignChannel[];
  if (input.schedule !== undefined) campaign.schedule = input.schedule;
  // A rejected campaign that gets edited goes back to being a fresh draft —
  // it needs to be resubmitted, not silently treated as still-rejected.
  if (campaign.status === "rejected") {
    campaign.status = "draft";
    campaign.approvalStatus = "not_required";
    campaign.reviewNote = undefined;
  }

  await campaign.save();
  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "campaign.edit",
    resource: "Campaign",
    resourceId: campaign._id.toString(),
    oldValue,
    newValue: { name: campaign.title },
  });

  return campaign;
}

export async function deleteCampaign(id: string, actor: CampaignActor): Promise<void> {
  const campaign = await CampaignModel.findById(id);
  if (!campaign) throw ApiError.notFound("Campaign not found");
  if (campaign.image?.publicId) await deleteCloudinaryImage(campaign.image.publicId);
  await campaign.deleteOne();
  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "campaign.delete",
    resource: "Campaign",
    resourceId: id,
    oldValue: { name: campaign.title },
  });
}

/**
 * Moves an approved (or Super-Admin-authored, never-gated) campaign into its
 * live state: an immediate dispatch for a "now" schedule, or a computed
 * `nextRunAt` for everything else. Never awaits the dispatch itself — the
 * caller (an HTTP request) gets a fast response, and `dispatchCampaign`
 * updates the document again once the send actually completes, the same
 * "kick off, don't block" shape as every fire-and-forget email elsewhere in
 * this project.
 */
async function activateCampaign(campaign: ICampaign, actor: CampaignActor): Promise<void> {
  if (campaign.schedule.type === "now") {
    campaign.status = "sending";
    await campaign.save();
    void dispatchCampaign(campaign._id.toString(), "manual", actor.id);
    return;
  }

  campaign.nextRunAt = computeNextRun(campaign.schedule, new Date());
  campaign.status = "scheduled";
  await campaign.save();
}

/**
 * Admin/Co-Admin: draft/rejected -> pending_approval, notifying every active
 * Super Admin (mirrors `pendingAction.service.ts#createPendingAction`'s
 * notify-every-super-admin pattern). Super Admin: since their own campaigns
 * never require approval, calling this on their own draft goes straight to
 * `activateCampaign` instead — one action, branching by actor, the same
 * shape `coupon.service.ts#resolveCouponGate` uses for its own actor-based
 * branching.
 */
export async function submitCampaign(id: string, actor: CampaignActor): Promise<ICampaign> {
  const campaign = await CampaignModel.findById(id);
  if (!campaign) throw ApiError.notFound("Campaign not found");
  if (!isOwnerOrSuperAdmin(campaign, actor)) {
    throw ApiError.forbidden("You do not have permission to submit this campaign");
  }
  if (campaign.status !== "draft" && campaign.status !== "rejected") {
    throw ApiError.badRequest(`Only a draft or rejected campaign can be submitted (currently "${campaign.status}")`);
  }

  if (actor.role === "super_admin") {
    campaign.approvalStatus = "not_required";
    await activateCampaign(campaign, actor);
    await recordAuditLog({
      actor: actor.id,
      actorRole: actor.role,
      action: "campaign.schedule",
      resource: "Campaign",
      resourceId: campaign._id.toString(),
      newValue: { name: campaign.title, status: campaign.status },
    });
    return campaign;
  }

  campaign.status = "pending_approval";
  campaign.approvalStatus = "pending";
  await campaign.save();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "campaign.submit",
    resource: "Campaign",
    resourceId: campaign._id.toString(),
    newValue: { name: campaign.title },
  });

  const [requester, superAdmins] = await Promise.all([
    UserModel.findById(actor.id),
    UserModel.find({ role: "super_admin", isActive: true }),
  ]);
  for (const admin of superAdmins) {
    void sendCampaignSubmittedEmail(admin.email, admin.name, {
      campaignTitle: campaign.title,
      submittedByName: requester?.name ?? "A staff member",
    });
  }

  return campaign;
}

export async function approveCampaign(id: string, actor: CampaignActor, note?: string): Promise<ICampaign> {
  const campaign = await CampaignModel.findById(id);
  if (!campaign) throw ApiError.notFound("Campaign not found");
  if (campaign.status !== "pending_approval") {
    throw ApiError.badRequest(`Only a campaign pending approval can be approved (currently "${campaign.status}")`);
  }

  campaign.approvalStatus = "approved";
  campaign.reviewedBy = actor.id as unknown as ICampaign["reviewedBy"];
  campaign.reviewedAt = new Date();
  campaign.reviewNote = note;
  await activateCampaign(campaign, actor);

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "campaign.approve",
    resource: "Campaign",
    resourceId: campaign._id.toString(),
    newValue: { name: campaign.title, status: campaign.status },
    note,
  });

  const requester = await UserModel.findById(campaign.createdBy);
  if (requester) {
    void sendCampaignReviewedEmail(requester.email, requester.name, {
      campaignTitle: campaign.title,
      status: "approved",
      reviewNote: note,
    });
  }

  return campaign;
}

export async function rejectCampaign(id: string, actor: CampaignActor, note?: string): Promise<ICampaign> {
  const campaign = await CampaignModel.findById(id);
  if (!campaign) throw ApiError.notFound("Campaign not found");
  if (campaign.status !== "pending_approval") {
    throw ApiError.badRequest(`Only a campaign pending approval can be rejected (currently "${campaign.status}")`);
  }

  campaign.status = "rejected";
  campaign.approvalStatus = "rejected";
  campaign.reviewedBy = actor.id as unknown as ICampaign["reviewedBy"];
  campaign.reviewedAt = new Date();
  campaign.reviewNote = note;
  await campaign.save();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "campaign.reject",
    resource: "Campaign",
    resourceId: campaign._id.toString(),
    newValue: { name: campaign.title },
    note,
  });

  const requester = await UserModel.findById(campaign.createdBy);
  if (requester) {
    void sendCampaignReviewedEmail(requester.email, requester.name, {
      campaignTitle: campaign.title,
      status: "rejected",
      reviewNote: note,
    });
  }

  return campaign;
}

const SEND_NOW_SOURCE_STATUSES = ["draft", "approved", "scheduled", "paused"];

/** Super Admin only — dispatches immediately regardless of the configured schedule, without disturbing a recurring campaign's normal cadence. */
export async function sendCampaignNow(id: string, actor: CampaignActor): Promise<ICampaign> {
  const campaign = await CampaignModel.findById(id);
  if (!campaign) throw ApiError.notFound("Campaign not found");
  if (!SEND_NOW_SOURCE_STATUSES.includes(campaign.status)) {
    throw ApiError.badRequest(`Cannot send a campaign that is currently "${campaign.status}"`);
  }

  campaign.status = "sending";
  await campaign.save();
  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "campaign.send",
    resource: "Campaign",
    resourceId: campaign._id.toString(),
    newValue: { name: campaign.title },
  });

  void dispatchCampaign(campaign._id.toString(), "manual", actor.id);
  return campaign;
}

export async function pauseCampaign(id: string, actor: CampaignActor): Promise<ICampaign> {
  const campaign = await CampaignModel.findById(id);
  if (!campaign) throw ApiError.notFound("Campaign not found");
  if (campaign.status !== "scheduled") {
    throw ApiError.badRequest(`Only a scheduled campaign can be paused (currently "${campaign.status}")`);
  }
  campaign.status = "paused";
  await campaign.save();
  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "campaign.pause",
    resource: "Campaign",
    resourceId: campaign._id.toString(),
    newValue: { name: campaign.title },
  });
  return campaign;
}

export async function resumeCampaign(id: string, actor: CampaignActor): Promise<ICampaign> {
  const campaign = await CampaignModel.findById(id);
  if (!campaign) throw ApiError.notFound("Campaign not found");
  if (campaign.status !== "paused") {
    throw ApiError.badRequest(`Only a paused campaign can be resumed (currently "${campaign.status}")`);
  }
  // Recomputed from now, not resumed from the old nextRunAt — otherwise a
  // campaign paused through several missed occurrences would fire an
  // instant backlog the moment it's resumed.
  campaign.nextRunAt = computeNextRun(campaign.schedule, new Date());
  campaign.status = "scheduled";
  await campaign.save();
  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "campaign.resume",
    resource: "Campaign",
    resourceId: campaign._id.toString(),
    newValue: { name: campaign.title },
  });
  return campaign;
}

// ---------------------------------------------------------------------------
// Dispatch — the actual send, across whichever channels the campaign uses.
// ---------------------------------------------------------------------------

async function dispatchEmailChannel(
  campaign: ICampaign,
  recipients: { name: string; email: string }[]
): Promise<ICampaignChannelResult> {
  const result: ICampaignChannelResult = {
    channel: "email",
    status: "sent",
    recipientCount: recipients.length,
    successCount: 0,
    failureCount: 0,
    failures: [],
  };
  const html = renderCampaignEmailHtml({ title: campaign.title, message: campaign.message, imageUrl: campaign.image?.url });

  for (let i = 0; i < recipients.length; i += EMAIL_BATCH_SIZE) {
    const batch = recipients.slice(i, i + EMAIL_BATCH_SIZE);
    const settled = await Promise.allSettled(batch.map((r) => sendMail({ to: r.email, subject: campaign.title, html })));
    settled.forEach((outcome, idx) => {
      if (outcome.status === "fulfilled") {
        result.successCount++;
      } else {
        result.failureCount++;
        if (result.failures.length < FAILURE_SAMPLE_LIMIT) {
          result.failures.push({ recipient: batch[idx].email, reason: (outcome.reason as Error)?.message ?? "Send failed" });
        }
      }
    });
  }
  if (result.recipientCount > 0 && result.successCount === 0) result.status = "failed";
  return result;
}

async function dispatchSmsChannel(
  campaign: ICampaign,
  recipients: { name: string; phone?: string }[]
): Promise<ICampaignChannelResult> {
  const withPhone = recipients.filter((r): r is { name: string; phone: string } => Boolean(r.phone));

  if (!isSmsConfigured) {
    return {
      channel: "sms",
      status: "skipped",
      recipientCount: withPhone.length,
      successCount: 0,
      failureCount: 0,
      skippedReason: "SMS gateway not configured",
      failures: [],
    };
  }

  const result: ICampaignChannelResult = {
    channel: "sms",
    status: "sent",
    recipientCount: withPhone.length,
    successCount: 0,
    failureCount: 0,
    failures: [],
  };
  const text = `${campaign.title}\n${campaign.message}`;
  for (const recipient of withPhone) {
    // sendSms() itself never throws — it resolves false on failure — so no
    // try/catch is needed here to isolate one recipient's failure from the rest.
    const ok = await sendSms(recipient.phone, text);
    if (ok) result.successCount++;
    else {
      result.failureCount++;
      if (result.failures.length < FAILURE_SAMPLE_LIMIT) {
        result.failures.push({ recipient: recipient.phone, reason: "SMS gateway rejected the message" });
      }
    }
  }
  if (result.recipientCount > 0 && result.successCount === 0) result.status = "failed";
  return result;
}

async function dispatchWebsiteChannel(
  campaign: ICampaign,
  recipients: { _id: unknown }[]
): Promise<ICampaignChannelResult> {
  const { successCount, failureCount } = await createCampaignNotifications({
    recipientIds: recipients.map((r) => r._id as string),
    campaignId: campaign._id.toString(),
    title: campaign.title,
    message: campaign.message,
    image: campaign.image,
  });
  return {
    channel: "website",
    status: recipients.length > 0 && successCount === 0 ? "failed" : "sent",
    recipientCount: recipients.length,
    successCount,
    failureCount,
    failures: [],
  };
}

/**
 * Runs the actual send across every channel the campaign uses, then records
 * the result. Always loads the campaign fresh (never trusts a document a
 * caller might have held onto) since this can run minutes after it was
 * triggered by the scheduler.
 */
export async function dispatchCampaign(
  campaignId: string,
  trigger: "scheduled" | "manual",
  triggeredBy?: string
): Promise<void> {
  const campaign = await CampaignModel.findById(campaignId);
  if (!campaign) return;

  try {
    const recipients = await getAudienceRecipients(campaign.targetAudience);

    const channelResults: ICampaignChannelResult[] = [];
    for (const channel of campaign.channels) {
      if (channel === "email") channelResults.push(await dispatchEmailChannel(campaign, recipients));
      else if (channel === "sms") channelResults.push(await dispatchSmsChannel(campaign, recipients));
      else channelResults.push(await dispatchWebsiteChannel(campaign, recipients));
    }

    campaign.deliveries = [
      ...campaign.deliveries,
      {
        triggeredAt: new Date(),
        triggeredBy: triggeredBy as unknown as ICampaign["deliveries"][number]["triggeredBy"],
        trigger,
        recipientCount: recipients.length,
        channelResults,
      },
    ].slice(-DELIVERY_HISTORY_LIMIT);
    campaign.lastSentAt = new Date();
    campaign.sendCount += 1;

    // A one-off schedule (or an ad-hoc manual send of one) is now finished;
    // a recurring schedule stays "scheduled" for its next occurrence unless
    // this was fired by the background scheduler, which advances it below.
    if (campaign.schedule.type === "now" || campaign.schedule.type === "custom") {
      campaign.status = "sent";
      campaign.nextRunAt = undefined;
    } else if (trigger === "scheduled") {
      campaign.nextRunAt = computeNextRun(campaign.schedule, campaign.nextRunAt ?? new Date());
      campaign.status = "scheduled";
    } else {
      // A manual "Send Now" ad-hoc trigger on a recurring campaign — leave
      // its normal cadence untouched.
      campaign.status = "scheduled";
    }

    await campaign.save();

    await recordAuditLog({
      actor: triggeredBy ?? "system",
      actorRole: campaign.createdByRole,
      action: "campaign.sent",
      resource: "Campaign",
      resourceId: campaign._id.toString(),
      newValue: {
        name: campaign.title,
        recipientCount: recipients.length,
        channels: channelResults.map((r) => `${r.channel}:${r.status}`),
      },
      note: trigger === "scheduled" ? "Sent by the background scheduler" : "Sent via Send Now",
    });
  } catch (err) {
    console.error(`[campaign] dispatch failed for ${campaignId}:`, (err as Error).message);
    campaign.status = "failed";
    await campaign.save();
    await recordAuditLog({
      actor: triggeredBy ?? "system",
      actorRole: campaign.createdByRole,
      action: "campaign.failed",
      resource: "Campaign",
      resourceId: campaign._id.toString(),
      note: (err as Error).message,
    });
  }
}

/**
 * Atomically "claims" every currently-due scheduled campaign — flips each to
 * "sending" one at a time via a conditional update (`status: "scheduled"` in
 * the filter) so a dispatch that runs long can never be picked up twice by
 * an overlapping tick, or fired again after being paused mid-flight. Returns
 * the ids actually claimed; `scheduler.service.ts` dispatches each one.
 */
export async function claimDueCampaigns(): Promise<string[]> {
  const due = await CampaignModel.find({ status: "scheduled", nextRunAt: { $lte: new Date() } }).select("_id");
  const claimedIds: string[] = [];
  for (const { _id } of due) {
    const claimed = await CampaignModel.findOneAndUpdate({ _id, status: "scheduled" }, { status: "sending" });
    if (claimed) claimedIds.push(_id.toString());
  }
  return claimedIds;
}

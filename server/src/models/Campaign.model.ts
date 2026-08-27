import { Schema, model, type Document, type Model, type Types } from "mongoose";
import type { Role } from "../constants/roles";

/**
 * Customer Messaging / Campaign Management System.
 *
 * A campaign is its own persistent document from the moment it's created —
 * unlike the generic Grant-Based Approval Workflow (`PendingAction`, see
 * `models/PendingAction.model.ts`), which exists for actions that have no
 * record of their own until a Super Admin grants them (a new product, a
 * stock delta). A campaign needs the opposite: an Admin/Co-Admin drafts it,
 * edits it repeatedly, and only later submits it — and everyone involved
 * (including Super Admin) needs to see Draft/Pending/Rejected campaigns
 * listed in the Campaign Management page throughout that process. So the
 * approval fields (`approvalStatus`, `reviewedBy`, `reviewedAt`,
 * `reviewNote`) live directly on this document instead of being routed
 * through `PendingAction` — `pendingAction.service.ts`'s "apply payload
 * verbatim on grant" model doesn't fit a document that already exists and
 * needs a multi-step edit history. Audit logging (`recordAuditLog`) and the
 * email-on-submit / email-on-review pattern are still reused as-is from
 * `pendingAction.service.ts`'s conventions — see `campaign.service.ts`.
 */
export const CAMPAIGN_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "scheduled",
  "sending",
  "sent",
  "paused",
  "rejected",
  "failed",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_SCHEDULE_TYPES = ["now", "weekly", "monthly", "custom"] as const;
export type CampaignScheduleType = (typeof CAMPAIGN_SCHEDULE_TYPES)[number];

/**
 * A campaign carries any combination of these rather than a fixed enum of
 * every combo ("Email Only", "Email + SMS", "All Available Channels", …) —
 * one array is simpler to validate and dispatch than five hand-enumerated
 * combinations that all reduce to the same three underlying channels.
 */
export const CAMPAIGN_CHANNELS = ["email", "sms", "website"] as const;
export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number];

export const CAMPAIGN_AUDIENCE_TYPES = ["all", "selected", "specific"] as const;
export type CampaignAudienceType = (typeof CAMPAIGN_AUDIENCE_TYPES)[number];

export interface ICampaignSchedule {
  type: CampaignScheduleType;
  /** "custom": the exact date/time to send. Unused for every other type. */
  sendAt?: Date;
  /** "weekly": 0 = Sunday .. 6 = Saturday. */
  dayOfWeek?: number;
  /** "monthly": 1-31; a shorter month sends on its own last day (see scheduler.service.ts#computeNextRun). */
  dayOfMonth?: number;
  /** "weekly"/"monthly": the hour/minute the send fires, in server local time. */
  hour?: number;
  minute?: number;
}

export interface ICampaignChannelResult {
  channel: CampaignChannel;
  status: "sent" | "failed" | "skipped";
  recipientCount: number;
  successCount: number;
  failureCount: number;
  /** Only set for "skipped" — e.g. "SMS gateway not configured". */
  skippedReason?: string;
  /**
   * A bounded sample of failures, not one row per recipient — with up to a
   * few thousand recipients, storing every failure would make the campaign
   * document grow without bound. `CAMPAIGN_FAILURE_SAMPLE_LIMIT` in
   * campaignDispatch.service.ts caps this; `failureCount` above is always
   * the true total even once the sample is capped.
   */
  failures: { recipient: string; reason: string }[];
}

export interface ICampaignTargetAudience {
  type: CampaignAudienceType;
  /** Only meaningful for "selected"/"specific" — "all" is always resolved
   * live against the current customer list, never against a stored list. */
  customerIds: Types.ObjectId[];
}

export interface ICampaignDelivery {
  triggeredAt: Date;
  triggeredBy?: Types.ObjectId;
  /** "scheduled" = fired by the background scheduler; "manual" = a Send Now action. */
  trigger: "scheduled" | "manual";
  recipientCount: number;
  channelResults: ICampaignChannelResult[];
}

export interface ICampaign extends Document {
  _id: Types.ObjectId;
  title: string;
  message: string;
  image?: { url: string; publicId: string };
  targetAudience: ICampaignTargetAudience;
  channels: CampaignChannel[];
  schedule: ICampaignSchedule;
  status: CampaignStatus;
  /** "not_required" for a Super-Admin-authored campaign, which never goes through review. */
  approvalStatus: "not_required" | "pending" | "approved" | "rejected";
  createdBy: Types.ObjectId;
  createdByRole: Role;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNote?: string;
  /** When the scheduler should next fire this campaign — unset for draft/sent/rejected/failed one-off campaigns. */
  nextRunAt?: Date;
  lastSentAt?: Date;
  sendCount: number;
  deliveries: ICampaignDelivery[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A real `Schema` instance, not an inline plain object, is required here:
 * Mongoose's type-inference special-cases any key literally named "type",
 * and a plain nested object whose own field is named "type" (`type:
 * CampaignAudienceType`) gets misread as a SchemaType descriptor by the
 * *parent* schema when assigned inline — the same reason `scheduleSchema`
 * below is its own `Schema` rather than an inline object.
 */
const targetAudienceSchema = new Schema<ICampaignTargetAudience>(
  {
    type: { type: String, enum: CAMPAIGN_AUDIENCE_TYPES, required: true },
    customerIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { _id: false }
);

const scheduleSchema = new Schema<ICampaignSchedule>(
  {
    type: { type: String, enum: CAMPAIGN_SCHEDULE_TYPES, required: true },
    sendAt: { type: Date },
    dayOfWeek: { type: Number, min: 0, max: 6 },
    dayOfMonth: { type: Number, min: 1, max: 31 },
    hour: { type: Number, min: 0, max: 23 },
    minute: { type: Number, min: 0, max: 59 },
  },
  { _id: false }
);

const channelResultSchema = new Schema<ICampaignChannelResult>(
  {
    channel: { type: String, enum: CAMPAIGN_CHANNELS, required: true },
    status: { type: String, enum: ["sent", "failed", "skipped"], required: true },
    recipientCount: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },
    skippedReason: { type: String, trim: true },
    failures: {
      type: [{ recipient: String, reason: String, _id: false }],
      default: [],
    },
  },
  { _id: false }
);

const deliverySchema = new Schema<ICampaignDelivery>(
  {
    triggeredAt: { type: Date, required: true },
    triggeredBy: { type: Schema.Types.ObjectId, ref: "User" },
    trigger: { type: String, enum: ["scheduled", "manual"], required: true },
    recipientCount: { type: Number, default: 0 },
    channelResults: { type: [channelResultSchema], default: [] },
  },
  { _id: true, timestamps: false }
);

const campaignSchema = new Schema<ICampaign>(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    image: {
      url: { type: String },
      publicId: { type: String },
    },
    targetAudience: { type: targetAudienceSchema, required: true },
    channels: {
      type: [{ type: String, enum: CAMPAIGN_CHANNELS }],
      required: true,
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length > 0,
        message: "At least one delivery channel is required",
      },
    },
    schedule: { type: scheduleSchema, required: true },
    status: { type: String, enum: CAMPAIGN_STATUSES, default: "draft", index: true },
    approvalStatus: {
      type: String,
      enum: ["not_required", "pending", "approved", "rejected"],
      default: "not_required",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdByRole: { type: String, required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true, maxlength: 500 },
    nextRunAt: { type: Date, index: true },
    lastSentAt: { type: Date },
    sendCount: { type: Number, default: 0 },
    deliveries: { type: [deliverySchema], default: [] },
  },
  { timestamps: true }
);

export const CampaignModel: Model<ICampaign> = model<ICampaign>("Campaign", campaignSchema);

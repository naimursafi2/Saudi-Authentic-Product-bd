import { z } from "zod";
import { booleanish } from "./common.validator";
import { CAMPAIGN_CHANNELS, CAMPAIGN_SCHEDULE_TYPES, CAMPAIGN_STATUSES } from "../models/Campaign.model";

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

const targetAudienceSchema = z
  .object({
    type: z.enum(["all", "selected", "specific"]),
    customerIds: z.array(objectId).optional().default([]),
  })
  .refine((data) => data.type !== "selected" || data.customerIds.length > 0, {
    message: "Select at least one customer",
    path: ["customerIds"],
  })
  .refine((data) => data.type !== "specific" || data.customerIds.length === 1, {
    message: "Choose exactly one customer",
    path: ["customerIds"],
  });

const scheduleSchema = z
  .object({
    type: z.enum(CAMPAIGN_SCHEDULE_TYPES),
    sendAt: z.coerce.date().optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    hour: z.number().int().min(0).max(23).optional(),
    minute: z.number().int().min(0).max(59).optional(),
  })
  .refine((data) => data.type !== "custom" || data.sendAt !== undefined, {
    message: "A custom schedule requires a send date/time",
    path: ["sendAt"],
  })
  .refine((data) => data.type !== "custom" || (data.sendAt as Date) > new Date(), {
    message: "The custom send date/time must be in the future",
    path: ["sendAt"],
  })
  .refine((data) => data.type !== "weekly" || data.dayOfWeek !== undefined, {
    message: "A weekly schedule requires a day of the week",
    path: ["dayOfWeek"],
  })
  .refine((data) => data.type !== "monthly" || data.dayOfMonth !== undefined, {
    message: "A monthly schedule requires a day of the month",
    path: ["dayOfMonth"],
  })
  .refine((data) => data.type !== "weekly" && data.type !== "monthly" ? true : data.hour !== undefined && data.minute !== undefined, {
    message: "A recurring schedule requires a time of day",
    path: ["hour"],
  });

const channelsSchema = z
  .array(z.enum(CAMPAIGN_CHANNELS))
  .min(1, "Select at least one delivery channel")
  .refine((v) => new Set(v).size === v.length, "Duplicate delivery channel");

export const createCampaignSchema = z.object({
  title: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(5000),
  targetAudience: targetAudienceSchema,
  channels: channelsSchema,
  schedule: scheduleSchema,
});

export const updateCampaignSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  message: z.string().trim().min(1).max(5000).optional(),
  targetAudience: targetAudienceSchema.optional(),
  channels: channelsSchema.optional(),
  schedule: scheduleSchema.optional(),
  /** Set true to remove the current banner image without uploading a new one. */
  removeImage: booleanish.optional().default(false),
});

export const campaignStatusEnum = z.enum(CAMPAIGN_STATUSES);

export const listCampaignsQuerySchema = z.object({
  status: campaignStatusEnum.optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const reviewCampaignSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export const audiencePreviewQuerySchema = z.object({
  type: z.enum(["all", "selected", "specific"]),
  customerIds: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : [])),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type ListCampaignsQuery = z.infer<typeof listCampaignsQuerySchema>;
export type ReviewCampaignInput = z.infer<typeof reviewCampaignSchema>;
export type AudiencePreviewQuery = z.infer<typeof audiencePreviewQuerySchema>;

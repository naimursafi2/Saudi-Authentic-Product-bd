import { api } from "./client";
import type {
  ApiCampaign,
  CampaignAudiencePreview,
  CampaignAudienceType,
  CampaignChannel,
  CampaignChannelStatus,
  CampaignScheduleType,
  CampaignStatus,
} from "@/types/api";

export interface CampaignSchedulePayload {
  type: CampaignScheduleType;
  sendAt?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  hour?: number;
  minute?: number;
}

export interface CampaignPayload {
  title: string;
  message: string;
  targetAudience: { type: CampaignAudienceType; customerIds?: string[] };
  channels: CampaignChannel[];
  schedule: CampaignSchedulePayload;
  removeImage?: boolean;
}

function toFormData(payload: CampaignPayload, image?: File | null): FormData {
  const form = new FormData();
  form.set("title", payload.title);
  form.set("message", payload.message);
  form.set("targetAudience", JSON.stringify(payload.targetAudience));
  form.set("channels", JSON.stringify(payload.channels));
  form.set("schedule", JSON.stringify(payload.schedule));
  if (payload.removeImage) form.set("removeImage", "true");
  if (image) form.append("image", image);
  return form;
}

export async function getChannelStatus() {
  return api.get<CampaignChannelStatus>("/campaigns/channel-status");
}

export async function getAudiencePreview(type: CampaignAudienceType, customerIds: string[] = []) {
  const search = new URLSearchParams({ type });
  if (customerIds.length > 0) search.set("customerIds", customerIds.join(","));
  return api.get<CampaignAudiencePreview>(`/campaigns/audience-preview?${search.toString()}`);
}

export interface ListCampaignsParams {
  status?: CampaignStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export async function listCampaigns(params: ListCampaignsParams = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.search) search.set("search", params.search);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return api.get<{ campaigns: ApiCampaign[] }>(`/campaigns${qs ? `?${qs}` : ""}`);
}

export async function getCampaign(id: string) {
  return api.get<{ campaign: ApiCampaign }>(`/campaigns/${id}`);
}

export async function createCampaign(payload: CampaignPayload, image?: File | null) {
  return api.postForm<{ campaign: ApiCampaign }>("/campaigns", toFormData(payload, image));
}

export async function updateCampaign(id: string, payload: Partial<CampaignPayload>, image?: File | null) {
  return api.patchForm<{ campaign: ApiCampaign }>(`/campaigns/${id}`, toFormData(payload as CampaignPayload, image));
}

export async function deleteCampaign(id: string) {
  return api.delete<null>(`/campaigns/${id}`);
}

export async function submitCampaign(id: string) {
  return api.post<{ campaign: ApiCampaign }>(`/campaigns/${id}/submit`, {});
}

export async function approveCampaign(id: string, note?: string) {
  return api.patch<{ campaign: ApiCampaign }>(`/campaigns/${id}/approve`, { note });
}

export async function rejectCampaign(id: string, note?: string) {
  return api.patch<{ campaign: ApiCampaign }>(`/campaigns/${id}/reject`, { note });
}

export async function sendCampaignNow(id: string) {
  return api.post<{ campaign: ApiCampaign }>(`/campaigns/${id}/send-now`, {});
}

export async function pauseCampaign(id: string) {
  return api.patch<{ campaign: ApiCampaign }>(`/campaigns/${id}/pause`, {});
}

export async function resumeCampaign(id: string) {
  return api.patch<{ campaign: ApiCampaign }>(`/campaigns/${id}/resume`, {});
}

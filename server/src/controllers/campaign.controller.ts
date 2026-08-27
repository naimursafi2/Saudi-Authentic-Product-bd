import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import * as campaignService from "../services/campaign.service";
import { isSmtpConfigured, isSmsConfigured } from "../config/env";
import type { AudiencePreviewQuery, ListCampaignsQuery, ReviewCampaignInput } from "../validators/campaign.validator";

function actorFrom(req: Request) {
  return { id: req.user!.id, role: req.user!.role };
}

/** The Delivery Channel Status panel — always read from the actual server
 * configuration, never hardcoded, per the spec's explicit requirement. */
export const getChannelStatus = catchAsync(async (_req: Request, res: Response) => {
  sendSuccess(res, 200, "Channel status fetched", {
    email: isSmtpConfigured,
    sms: isSmsConfigured,
    website: true,
  });
});

export const getAudiencePreview = catchAsync(async (req: Request, res: Response) => {
  const { type, customerIds } = req.query as unknown as AudiencePreviewQuery;
  const preview = await campaignService.getAudiencePreview({ type, customerIds });
  sendSuccess(res, 200, "Audience preview fetched", preview);
});

export const listCampaigns = catchAsync(async (req: Request, res: Response) => {
  const { status, search, page, limit } = req.query as unknown as ListCampaignsQuery;
  const { campaigns, pagination } = await campaignService.listCampaigns({ status, search, page, limit }, actorFrom(req));
  sendSuccess(res, 200, "Campaigns fetched", { campaigns }, { pagination });
});

export const getCampaign = catchAsync(async (req: Request, res: Response) => {
  const campaign = await campaignService.getCampaignById(paramStr(req.params.id), actorFrom(req));
  sendSuccess(res, 200, "Campaign fetched", { campaign });
});

export const createCampaign = catchAsync(async (req: Request, res: Response) => {
  const campaign = await campaignService.createCampaign(req.body, actorFrom(req), req.file);
  sendSuccess(res, 201, "Campaign created as a draft", { campaign });
});

export const updateCampaign = catchAsync(async (req: Request, res: Response) => {
  const campaign = await campaignService.updateCampaign(paramStr(req.params.id), req.body, actorFrom(req), req.file);
  sendSuccess(res, 200, "Campaign updated", { campaign });
});

export const deleteCampaign = catchAsync(async (req: Request, res: Response) => {
  await campaignService.deleteCampaign(paramStr(req.params.id), actorFrom(req));
  sendSuccess(res, 200, "Campaign deleted");
});

export const submitCampaign = catchAsync(async (req: Request, res: Response) => {
  const campaign = await campaignService.submitCampaign(paramStr(req.params.id), actorFrom(req));
  const message =
    req.user!.role === "super_admin"
      ? "Campaign scheduled"
      : "Campaign submitted for Super Admin approval";
  sendSuccess(res, 200, message, { campaign });
});

export const approveCampaign = catchAsync(async (req: Request, res: Response) => {
  const { note } = req.body as ReviewCampaignInput;
  const campaign = await campaignService.approveCampaign(paramStr(req.params.id), actorFrom(req), note);
  sendSuccess(res, 200, "Campaign approved", { campaign });
});

export const rejectCampaign = catchAsync(async (req: Request, res: Response) => {
  const { note } = req.body as ReviewCampaignInput;
  const campaign = await campaignService.rejectCampaign(paramStr(req.params.id), actorFrom(req), note);
  sendSuccess(res, 200, "Campaign rejected", { campaign });
});

export const sendCampaignNow = catchAsync(async (req: Request, res: Response) => {
  const campaign = await campaignService.sendCampaignNow(paramStr(req.params.id), actorFrom(req));
  sendSuccess(res, 200, "Campaign is sending", { campaign });
});

export const pauseCampaign = catchAsync(async (req: Request, res: Response) => {
  const campaign = await campaignService.pauseCampaign(paramStr(req.params.id), actorFrom(req));
  sendSuccess(res, 200, "Campaign paused", { campaign });
});

export const resumeCampaign = catchAsync(async (req: Request, res: Response) => {
  const campaign = await campaignService.resumeCampaign(paramStr(req.params.id), actorFrom(req));
  sendSuccess(res, 200, "Campaign resumed", { campaign });
});

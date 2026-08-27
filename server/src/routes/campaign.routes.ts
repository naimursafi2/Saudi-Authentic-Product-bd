import { Router } from "express";
import * as campaignController from "../controllers/campaign.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { upload } from "../middlewares/upload.middleware";
import { parseMultipartJsonFields } from "../middlewares/parseMultipartJson.middleware";
import {
  audiencePreviewQuerySchema,
  createCampaignSchema,
  listCampaignsQuerySchema,
  reviewCampaignSchema,
  updateCampaignSchema,
} from "../validators/campaign.validator";
import { mongoIdParamSchema } from "../validators/common.validator";

const router = Router();

const parseCampaignJsonFields = parseMultipartJsonFields(["targetAudience", "channels", "schedule"]);

router.use(authenticate);

// -- Read: available to every role holding campaigns.view (Co-Admin, Admin,
// Super Admin) — list/detail are further scoped server-side to the caller's
// own campaigns unless they hold campaigns.approve (Super Admin only). --
router.get("/channel-status", requirePermission("campaigns.view"), campaignController.getChannelStatus);
router.get(
  "/audience-preview",
  requirePermission("campaigns.view"),
  validate({ query: audiencePreviewQuerySchema }),
  campaignController.getAudiencePreview
);
router.get(
  "/",
  requirePermission("campaigns.view"),
  validate({ query: listCampaignsQuerySchema }),
  campaignController.listCampaigns
);
router.get(
  "/:id",
  requirePermission("campaigns.view"),
  validate({ params: mongoIdParamSchema }),
  campaignController.getCampaign
);

// -- Create/edit/delete --
router.post(
  "/",
  requirePermission("campaigns.create"),
  upload.single("image"),
  parseCampaignJsonFields,
  validate({ body: createCampaignSchema }),
  campaignController.createCampaign
);
router.patch(
  "/:id",
  requirePermission("campaigns.edit"),
  upload.single("image"),
  parseCampaignJsonFields,
  validate({ params: mongoIdParamSchema, body: updateCampaignSchema }),
  campaignController.updateCampaign
);
router.delete(
  "/:id",
  requirePermission("campaigns.delete"),
  validate({ params: mongoIdParamSchema }),
  campaignController.deleteCampaign
);

// -- Workflow: submit (Co-Admin/Admin -> pending approval; Super Admin ->
// scheduled/sent directly, see campaign.service.ts#submitCampaign) --
router.post(
  "/:id/submit",
  requirePermission("campaigns.create"),
  validate({ params: mongoIdParamSchema }),
  campaignController.submitCampaign
);

// -- Super Admin only: approve/reject/send/pause/resume --
router.patch(
  "/:id/approve",
  requirePermission("campaigns.approve"),
  validate({ params: mongoIdParamSchema, body: reviewCampaignSchema }),
  campaignController.approveCampaign
);
router.patch(
  "/:id/reject",
  requirePermission("campaigns.approve"),
  validate({ params: mongoIdParamSchema, body: reviewCampaignSchema }),
  campaignController.rejectCampaign
);
router.post(
  "/:id/send-now",
  requirePermission("campaigns.send"),
  validate({ params: mongoIdParamSchema }),
  campaignController.sendCampaignNow
);
router.patch(
  "/:id/pause",
  requirePermission("campaigns.send"),
  validate({ params: mongoIdParamSchema }),
  campaignController.pauseCampaign
);
router.patch(
  "/:id/resume",
  requirePermission("campaigns.send"),
  validate({ params: mongoIdParamSchema }),
  campaignController.resumeCampaign
);

export default router;

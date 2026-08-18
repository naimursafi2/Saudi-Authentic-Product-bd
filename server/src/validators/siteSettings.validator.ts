import { z } from "zod";
import { SOCIAL_PLATFORMS } from "../models/SiteSettings.model";

const socialLinkSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  url: z.string().trim().min(1).max(300),
});

export const updateSiteSettingsSchema = z.object({
  siteName: z.string().trim().min(1).max(120).optional(),
  announcementText: z.string().trim().max(200).optional(),
  contactEmail: z.string().trim().max(120).optional(),
  contactPhone: z.string().trim().max(30).optional(),
  footerTagline: z.string().trim().max(200).optional(),
  socialLinks: z.array(socialLinkSchema).max(10).optional(),
});

export type UpdateSiteSettingsInput = z.infer<typeof updateSiteSettingsSchema>;

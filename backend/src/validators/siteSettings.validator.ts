import { z } from "zod";

export const updateSiteSettingsSchema = z.object({
  siteName: z.string().trim().min(1).max(120).optional(),
  announcementText: z.string().trim().max(200).optional(),
  contactEmail: z.string().trim().max(120).optional(),
  contactPhone: z.string().trim().max(30).optional(),
  footerTagline: z.string().trim().max(200).optional(),
});

export type UpdateSiteSettingsInput = z.infer<typeof updateSiteSettingsSchema>;

import { Schema, model, type Document, type Model, type Types } from "mongoose";

export const SOCIAL_PLATFORMS = [
  "facebook",
  "instagram",
  "twitter",
  "youtube",
  "linkedin",
  "whatsapp",
  "tiktok",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export interface ISocialLink {
  platform: SocialPlatform;
  url: string;
}

const socialLinkSchema = new Schema<ISocialLink>(
  {
    platform: { type: String, required: true, enum: SOCIAL_PLATFORMS },
    url: { type: String, required: true, trim: true, maxlength: 300 },
  },
  { _id: false }
);

/** Singleton — always exactly one document, see `siteSettings.service.ts#getSettings`. */
export interface ISiteSettings extends Document {
  _id: Types.ObjectId;
  siteName: string;
  logo?: { url: string; publicId: string };
  /**
   * Whether the storefront renders the announcement strip above the header.
   * Defaults to `false` so the strip stays hidden until an Admin/Super Admin
   * deliberately switches it on (e.g. for Eid or a sale) — an existing
   * settings document saved before this field was added has no value here,
   * which reads as falsy and therefore also stays hidden.
   */
  announcementEnabled: boolean;
  announcementText?: string;
  contactEmail?: string;
  contactPhone?: string;
  footerTagline?: string;
  socialLinks: ISocialLink[];
  createdAt: Date;
  updatedAt: Date;
}

const siteSettingsSchema = new Schema<ISiteSettings>(
  {
    siteName: { type: String, required: true, trim: true, maxlength: 120 },
    logo: {
      url: { type: String },
      publicId: { type: String },
    },
    announcementEnabled: { type: Boolean, default: false },
    announcementText: { type: String, trim: true, maxlength: 200 },
    contactEmail: { type: String, trim: true, maxlength: 120 },
    contactPhone: { type: String, trim: true, maxlength: 30 },
    footerTagline: { type: String, trim: true, maxlength: 200 },
    socialLinks: { type: [socialLinkSchema], default: [] },
  },
  { timestamps: true }
);

export const SiteSettingsModel: Model<ISiteSettings> = model<ISiteSettings>(
  "SiteSettings",
  siteSettingsSchema
);

export const SITE_SETTINGS_DEFAULTS: Pick<
  ISiteSettings,
  "siteName" | "announcementEnabled" | "announcementText" | "contactEmail" | "footerTagline"
> = {
  siteName: "Saudi Authentic Product",
  // Off by default — the text below is only a starting point for whoever
  // switches the strip on, it does not make the strip appear on its own.
  announcementEnabled: false,
  announcementText: "Premium Authentic Saudi Products Delivered Across Bangladesh",
  contactEmail: "hello@saudiauthenticproduct.com",
  footerTagline: "Bringing Saudi heritage to Bangladesh.",
};

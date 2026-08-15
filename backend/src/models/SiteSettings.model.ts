import { Schema, model, type Document, type Model, type Types } from "mongoose";

/** Singleton — always exactly one document, see `siteSettings.service.ts#getSettings`. */
export interface ISiteSettings extends Document {
  _id: Types.ObjectId;
  siteName: string;
  logo?: { url: string; publicId: string };
  announcementText?: string;
  contactEmail?: string;
  contactPhone?: string;
  footerTagline?: string;
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
    announcementText: { type: String, trim: true, maxlength: 200 },
    contactEmail: { type: String, trim: true, maxlength: 120 },
    contactPhone: { type: String, trim: true, maxlength: 30 },
    footerTagline: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true }
);

export const SiteSettingsModel: Model<ISiteSettings> = model<ISiteSettings>(
  "SiteSettings",
  siteSettingsSchema
);

export const SITE_SETTINGS_DEFAULTS: Pick<
  ISiteSettings,
  "siteName" | "announcementText" | "contactEmail" | "footerTagline"
> = {
  siteName: "Saudi Authentic Product",
  announcementText: "Premium Authentic Saudi Products Delivered Across Bangladesh",
  contactEmail: "hello@saudiauthenticproduct.com",
  footerTagline: "Bringing Saudi heritage to Bangladesh.",
};

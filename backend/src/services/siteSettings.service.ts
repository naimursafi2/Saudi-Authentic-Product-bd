import { SiteSettingsModel, SITE_SETTINGS_DEFAULTS } from "../models/SiteSettings.model";
import { deleteCloudinaryImage, uploadBufferToCloudinary } from "../config/cloudinary";
import type { UpdateSiteSettingsInput } from "../validators/siteSettings.validator";

const FOLDER = "saudi-authentic-product/branding";

/** Singleton — lazily creates the one settings document if it doesn't exist yet. */
export async function getSettings() {
  return SiteSettingsModel.findOneAndUpdate(
    {},
    { $setOnInsert: SITE_SETTINGS_DEFAULTS },
    { upsert: true, new: true }
  );
}

export async function updateSettings(input: UpdateSiteSettingsInput, logoFile?: Express.Multer.File) {
  const settings = await getSettings();
  Object.assign(settings, input);

  if (logoFile) {
    if (settings.logo?.publicId) await deleteCloudinaryImage(settings.logo.publicId);
    const uploaded = await uploadBufferToCloudinary(logoFile.buffer, { folder: FOLDER });
    settings.logo = { url: uploaded.url, publicId: uploaded.publicId };
  }

  await settings.save();
  return settings;
}

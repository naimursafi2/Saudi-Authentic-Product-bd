import { SiteSettingsModel, SITE_SETTINGS_DEFAULTS } from "../models/SiteSettings.model";
import { retireInternalAsset, uploadInternalFile, type AssetActor } from "./internalAsset.service";
import { recordAuditLog } from "./auditLog.service";
import { revalidateFrontendTag } from "../utils/revalidateFrontend";
import type { UpdateSiteSettingsInput } from "../validators/siteSettings.validator";
import type { Role } from "../constants/roles";

const FOLDER = "saudi-authentic-product/branding";

/** Singleton — lazily creates the one settings document if it doesn't exist yet. */
export async function getSettings() {
  return SiteSettingsModel.findOneAndUpdate(
    {},
    { $setOnInsert: SITE_SETTINGS_DEFAULTS },
    { upsert: true, returnDocument: "after" }
  );
}

export async function updateSettings(
  input: UpdateSiteSettingsInput,
  actor: AssetActor,
  logoFile?: Express.Multer.File
) {
  const settings = await getSettings();
  Object.assign(settings, input);

  if (logoFile) {
    await retireInternalAsset(settings.logo?.publicId, actor, "Site logo replaced");
    const uploaded = await uploadInternalFile(logoFile, { folder: FOLDER, resource: "SiteSettings", fieldPath: "logo", module: "Settings", actor });
    settings.logo = { url: uploaded.url, publicId: uploaded.publicId };
  }

  await settings.save();
  revalidateFrontendTag("site-settings");
  return settings;
}

/**
 * Logo-only update — the narrower path `content.branding.manage` grants
 * (Co-Admin included), separate from the full `updateSettings` above which
 * stays gated behind `settings.manage`. Used by the navbar's dynamic logo:
 * the header always reads `SiteSettings.logo.url`, so a change here shows up
 * across the storefront immediately with no further wiring.
 */
export async function updateLogo(
  logoFile: Express.Multer.File,
  actor: { id: string; role: Role }
) {
  const settings = await getSettings();
  const previousUrl = settings.logo?.url ?? null;

  await retireInternalAsset(settings.logo?.publicId, actor, "Site logo replaced");
  const uploaded = await uploadInternalFile(logoFile, { folder: FOLDER, resource: "SiteSettings", fieldPath: "logo", module: "Settings", actor });
  settings.logo = { url: uploaded.url, publicId: uploaded.publicId };
  await settings.save();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "siteSettings.logo.update",
    resource: "SiteSettings",
    resourceId: settings._id.toString(),
    oldValue: { logo: previousUrl },
    newValue: { logo: settings.logo.url },
    note: "Company logo updated",
  });

  revalidateFrontendTag("site-settings");
  return settings;
}

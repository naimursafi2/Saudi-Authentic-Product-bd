"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ApiSiteSettings, ApiSocialLink, SocialPlatform } from "@/types/api";

export interface SiteSettingsFormValues {
  siteName: string;
  announcementText: string;
  contactEmail: string;
  contactPhone: string;
  footerTagline: string;
  socialLinks: ApiSocialLink[];
}

const SOCIAL_PLATFORMS: SocialPlatform[] = [
  "facebook",
  "instagram",
  "twitter",
  "youtube",
  "linkedin",
  "whatsapp",
  "tiktok",
];

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

function fromSettings(settings: ApiSiteSettings): SiteSettingsFormValues {
  return {
    siteName: settings.siteName,
    announcementText: settings.announcementText ?? "",
    contactEmail: settings.contactEmail ?? "",
    contactPhone: settings.contactPhone ?? "",
    footerTagline: settings.footerTagline ?? "",
    socialLinks: settings.socialLinks,
  };
}

export function SiteSettingsForm({
  settings,
  error,
  isSubmitting,
  onSubmit,
}: {
  settings: ApiSiteSettings;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (values: SiteSettingsFormValues, logo: File | null) => void;
}) {
  const [values, setValues] = useState<SiteSettingsFormValues>(() => fromSettings(settings));
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  function update<K extends keyof SiteSettingsFormValues>(key: K, value: SiteSettingsFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateSocialLink(index: number, field: keyof ApiSocialLink, value: string) {
    setValues((prev) => ({
      ...prev,
      socialLinks: prev.socialLinks.map((link, i) =>
        i === index ? { ...link, [field]: value } : link
      ),
    }));
  }

  function addSocialLink() {
    setValues((prev) => ({
      ...prev,
      socialLinks: [...prev.socialLinks, { platform: "facebook", url: "" }],
    }));
  }

  function removeSocialLink(index: number) {
    setValues((prev) => ({ ...prev, socialLinks: prev.socialLinks.filter((_, i) => i !== index) }));
  }

  function handleLogoChange(file: File | null) {
    setLogo(file);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values, logo);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-lg border border-brown-600/10 bg-white p-6">
      <div>
        <label className={labelClasses}>Logo</label>
        <div className="flex items-center gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brown-600/15 bg-cream-200">
            {(() => {
              const logoSrc = logoPreview ?? settings.logo?.url;
              return logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSrc} alt="Site logo" className="size-full object-cover" />
              ) : (
                <span className="text-xs text-brown-500">No logo</span>
              );
            })()}
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleLogoChange(e.target.files?.[0] ?? null)}
            className="text-sm text-brown-600"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Site Name *</label>
          <input
            required
            value={values.siteName}
            onChange={(e) => update("siteName", e.target.value)}
            className={fieldClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Footer Tagline</label>
          <input
            value={values.footerTagline}
            onChange={(e) => update("footerTagline", e.target.value)}
            className={fieldClasses}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClasses}>Announcement Bar Text</label>
          <input
            value={values.announcementText}
            onChange={(e) => update("announcementText", e.target.value)}
            placeholder="Leave blank to hide the announcement bar"
            className={fieldClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Contact Email</label>
          <input
            value={values.contactEmail}
            onChange={(e) => update("contactEmail", e.target.value)}
            className={fieldClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Contact Phone</label>
          <input
            value={values.contactPhone}
            onChange={(e) => update("contactPhone", e.target.value)}
            className={fieldClasses}
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className={labelClasses}>Social Links</label>
          <Button type="button" variant="outline" size="sm" onClick={addSocialLink}>
            <Plus size={12} /> Add Social Link
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {values.socialLinks.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={link.platform}
                onChange={(e) => updateSocialLink(i, "platform", e.target.value)}
                className={fieldClasses}
              >
                {SOCIAL_PLATFORMS.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </select>
              <input
                required
                value={link.url}
                onChange={(e) => updateSocialLink(i, "url", e.target.value)}
                placeholder="https://..."
                className={fieldClasses}
              />
              <button
                type="button"
                aria-label="Remove social link"
                onClick={() => removeSocialLink(i)}
                className="shrink-0 cursor-pointer text-brown-500 hover:text-[#8a4a3f]"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {values.socialLinks.length === 0 && (
            <p className="text-xs text-brown-500">No social links yet — add one above.</p>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-[#8a4a3f]">{error}</p>}

      <div className="flex justify-end border-t border-brown-600/10 pt-4">
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </form>
  );
}

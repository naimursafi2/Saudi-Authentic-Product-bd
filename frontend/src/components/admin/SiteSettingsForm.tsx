"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ApiSiteSettings } from "@/types/api";

export interface SiteSettingsFormValues {
  siteName: string;
  announcementText: string;
  contactEmail: string;
  contactPhone: string;
  footerTagline: string;
}

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

      {error && <p className="text-sm text-[#8a4a3f]">{error}</p>}

      <div className="flex justify-end border-t border-brown-600/10 pt-4">
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ApiSiteSettings } from "@/types/api";

const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

/**
 * Narrower sibling of `SiteSettingsForm` — Co-Admin holds
 * `content.branding.manage` but not `settings.manage`, so it can change only
 * the logo, not the rest of site settings. See `/admin/settings/page.tsx`.
 */
export function BrandingLogoForm({
  settings,
  error,
  isSubmitting,
  onSubmit,
}: {
  settings: ApiSiteSettings;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (logo: File) => void;
}) {
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  function handleLogoChange(file: File | null) {
    setLogo(file);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (logo) onSubmit(logo);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-lg border border-brown-600/10 bg-surface p-6"
    >
      <div>
        <label className={labelClasses}>Company Logo</label>
        <p className="mb-3 text-xs text-brown-500">
          Uploading a new logo replaces it across the storefront navbar immediately.
        </p>
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-32 shrink-0 items-center justify-center overflow-hidden rounded border border-brown-600/15 bg-cream-200 p-2">
            {(() => {
              const logoSrc = logoPreview ?? settings.logo?.url;
              return logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSrc} alt="Site logo" className="max-h-full max-w-full object-contain" />
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

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end border-t border-brown-600/10 pt-4">
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting || !logo}>
          {isSubmitting ? "Saving..." : "Save Logo"}
        </Button>
      </div>
    </form>
  );
}

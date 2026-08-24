"use client";

import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { getSiteSettings, updateSiteSettings, updateSiteLogo } from "@/lib/api/siteSettings";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { SiteSettingsForm, type SiteSettingsFormValues } from "@/components/admin/SiteSettingsForm";
import { BrandingLogoForm } from "@/components/admin/BrandingLogoForm";
import type { ApiSiteSettings } from "@/types/api";

export default function AdminSettingsPage() {
  const { hasPermission } = useAuth();
  const canManageSettings = hasPermission("settings.manage");
  // Co-Admin holds this narrower permission instead — logo only, not the
  // rest of site settings (see BrandingLogoForm's comment).
  const canManageLogo = hasPermission("content.branding.manage");
  const isRestricted = !canManageSettings && !canManageLogo;

  const [settings, setSettings] = useState<ApiSiteSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function load() {
    setIsLoading(true);
    getSiteSettings()
      .then(({ data }) => {
        setSettings(data.settings);
        setError(null);
      })
      .catch(() => setError("Could not load site settings."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, []);

  async function handleSubmit(values: SiteSettingsFormValues, logo: File | null) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      const form = new FormData();
      form.set("siteName", values.siteName);
      form.set("announcementEnabled", String(values.announcementEnabled));
      form.set("announcementText", values.announcementText);
      form.set("contactEmail", values.contactEmail);
      form.set("contactPhone", values.contactPhone);
      form.set("footerTagline", values.footerTagline);
      form.set("socialLinks", JSON.stringify(values.socialLinks));
      if (logo) form.set("logo", logo);
      const { data } = await updateSiteSettings(form);
      setSettings(data.settings);
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not save settings.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogoSubmit(logo: File) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      const form = new FormData();
      form.set("logo", logo);
      const { data } = await updateSiteLogo(form);
      setSettings(data.settings);
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not save logo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isRestricted) {
    return (
      <div>
        <PageHeader title="Settings" />
        <EmptyState
          icon={Settings}
          title="Access restricted"
          description="Site settings is available to Admin and Super Admin only."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description={
          canManageSettings
            ? "Site logo, branding, and the storefront's announcement bar."
            : "Company logo."
        }
      />

      {isLoading ? (
        <TableSkeleton rows={3} />
      ) : error || !settings ? (
        <ErrorState message={error ?? "Could not load site settings."} />
      ) : canManageSettings ? (
        <SiteSettingsForm settings={settings} error={formError} isSubmitting={isSubmitting} onSubmit={handleSubmit} />
      ) : (
        <BrandingLogoForm
          settings={settings}
          error={formError}
          isSubmitting={isSubmitting}
          onSubmit={handleLogoSubmit}
        />
      )}
    </div>
  );
}

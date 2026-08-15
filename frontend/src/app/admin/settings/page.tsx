"use client";

import { useEffect, useState } from "react";
import { getSiteSettings, updateSiteSettings } from "@/lib/api/siteSettings";
import { ApiClientError } from "@/lib/api/client";
import { PageHeader } from "@/components/admin/PageHeader";
import { TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { SiteSettingsForm, type SiteSettingsFormValues } from "@/components/admin/SiteSettingsForm";
import type { ApiSiteSettings } from "@/types/api";

export default function AdminSettingsPage() {
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
      form.set("announcementText", values.announcementText);
      form.set("contactEmail", values.contactEmail);
      form.set("contactPhone", values.contactPhone);
      form.set("footerTagline", values.footerTagline);
      if (logo) form.set("logo", logo);
      const { data } = await updateSiteSettings(form);
      setSettings(data.settings);
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not save settings.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Site logo, branding, and the storefront's announcement bar."
      />

      {isLoading ? (
        <TableSkeleton rows={3} />
      ) : error || !settings ? (
        <ErrorState message={error ?? "Could not load site settings."} />
      ) : (
        <SiteSettingsForm settings={settings} error={formError} isSubmitting={isSubmitting} onSubmit={handleSubmit} />
      )}
    </div>
  );
}

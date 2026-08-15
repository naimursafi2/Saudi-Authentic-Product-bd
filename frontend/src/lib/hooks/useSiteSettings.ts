"use client";

import { useEffect, useState } from "react";
import { getSiteSettings } from "@/lib/api/siteSettings";
import type { ApiSiteSettings } from "@/types/api";

export function useSiteSettings() {
  const [settings, setSettings] = useState<ApiSiteSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSiteSettings()
      .then(({ data }) => {
        if (!cancelled) setSettings(data.settings);
      })
      .catch(() => {
        // Client-side chrome (header logo/name) — a fetch failure here just
        // keeps the static fallback, never blocks the page.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { settings };
}

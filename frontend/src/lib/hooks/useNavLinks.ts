"use client";

import { useEffect, useState } from "react";
import { listNavLinks } from "@/lib/api/navLinks";
import type { ApiNavLink } from "@/types/api";

export function useNavLinks() {
  const [navLinks, setNavLinks] = useState<ApiNavLink[]>([]);

  useEffect(() => {
    let cancelled = false;
    listNavLinks()
      .then(({ data }) => {
        if (!cancelled) setNavLinks([...data.navLinks].sort((a, b) => a.sortOrder - b.sortOrder));
      })
      .catch(() => {
        // Header chrome — a fetch failure here just leaves the nav empty
        // rather than blocking the page.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { navLinks };
}

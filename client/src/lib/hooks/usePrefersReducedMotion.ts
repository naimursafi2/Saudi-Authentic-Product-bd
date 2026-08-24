"use client";

import { useSyncExternalStore } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * Reads the viewer's reduced-motion preference without a setState-in-effect
 * (this project's lint config rejects that pattern). The server snapshot is
 * `false` so SSR and the first client render agree, and React re-renders on
 * its own if the OS setting changes mid-session. Shared by every carousel
 * (`HeroCarousel`, `BannerCarousel`) rather than each keeping its own copy.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false
  );
}

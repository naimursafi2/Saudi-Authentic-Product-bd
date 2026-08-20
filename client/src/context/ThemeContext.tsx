"use client";

import { createContext, useCallback, useContext, useState } from "react";

export type Theme = "light" | "dark";

/** Shared with the pre-hydration script in app/layout.tsx — keep in sync. */
export const THEME_STORAGE_KEY = "sap:theme";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Reads the theme the pre-hydration script in `app/layout.tsx` already
 * applied to <html>. On the server there is no document, so this reports
 * "light" — which is exactly what the server renders. Nothing in the tree
 * renders differently based on this value (ThemeToggle swaps its icons in
 * CSS, not in JS), so the two never disagree in the markup.
 */
function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/**
 * Light/dark theme for the whole app — storefront and every portal.
 *
 * The styling lives in `globals.css`, which redefines the palette variables
 * under `[data-theme="dark"]`; this provider only flips that one attribute
 * on <html> and remembers the choice. Initial state is read lazily rather
 * than set from an effect, so there is no cascading render on mount.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readTheme);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private browsing / storage disabled: the theme still applies for
      // this session, it just won't be remembered. Not worth surfacing.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    // Read from the DOM rather than from `theme`, so a toggle still does the
    // right thing on the very first click after hydration.
    setTheme(readTheme() === "dark" ? "light" : "dark");
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

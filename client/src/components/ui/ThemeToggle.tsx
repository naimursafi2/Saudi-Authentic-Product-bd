"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

/**
 * Light/dark switch, used in the storefront header and in each portal shell
 * (admin / employee / delivery) so every role can switch theme in place.
 *
 * Both icons are always rendered; CSS in globals.css shows exactly one based
 * on `[data-theme]` on <html>. Doing it in CSS rather than from React state
 * means the correct icon is present in the server-rendered markup and during
 * the pre-hydration paint, so there is no hydration mismatch and no icon
 * flicker on first load.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className={cn(
        "flex cursor-pointer items-center justify-center rounded-full p-2 text-green-950 transition-colors duration-200 hover:bg-green-950/[0.08] hover:text-gold-600",
        className
      )}
    >
      <Moon size={18} className="icon-when-light" />
      <Sun size={18} className="icon-when-dark" />
    </button>
  );
}

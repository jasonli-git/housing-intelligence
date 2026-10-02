"use client";

import { useEffect, useState } from "react";

import { THEME_KEY, type Theme, applyTheme, parseTheme, shown, toggled } from "@/lib/theme";

const DARK = "(prefers-color-scheme: dark)";

/**
 * One button: it switches between light and dark, and the page follows the system until
 * it is pressed (ARCHITECTURE #292, replacing #134's three-way control at the owner's
 * request, 2026-10-02). Pressing back to the system's own theme returns to following
 * the system.
 *
 * The icon is chosen by CSS from what the page shows — a sun on a dark page, a moon on
 * a light one, each the theme a press leads to — so it is right on the first paint,
 * before React knows the theme, and never flickers.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    try {
      setTheme(parseTheme(localStorage.getItem(THEME_KEY)));
    } catch {
      // Storage is blocked: the page follows the system, which is what applies.
    }
    const query = window.matchMedia(DARK);
    setSystemDark(query.matches);
    const follow = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, []);

  function press() {
    const next = toggled(theme, window.matchMedia(DARK).matches);
    setTheme(next);
    applyTheme(document.documentElement, next);
    try {
      if (next === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {
      // The choice holds for this page even when it cannot be remembered.
    }
  }

  const label = `Switch to the ${shown(theme, systemDark) === "dark" ? "light" : "dark"} theme`;
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <button type="button" className="bar-icon theme-toggle" onClick={press} aria-label={label} title={label}>
      <svg className="theme-sun" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" {...stroke}>
        <circle cx="8" cy="8" r="2.8" />
        <path d="M8 1.5v1.4M8 13.1v1.4M1.5 8h1.4M13.1 8h1.4M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
      </svg>
      <svg className="theme-moon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" {...stroke}>
        <path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8Z" />
      </svg>
    </button>
  );
}

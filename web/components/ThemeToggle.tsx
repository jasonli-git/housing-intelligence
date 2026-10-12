"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";

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
  const chosen = useRef<Theme>("system");
  const bloom = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      chosen.current = parseTheme(localStorage.getItem(THEME_KEY));
      setTheme(chosen.current);
    } catch {
      // Storage is blocked: the page follows the system, which is what applies.
    }
    const query = window.matchMedia(DARK);
    setSystemDark(query.matches);
    const follow = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", follow);
    return () => { query.removeEventListener("change", follow); bloom.current?.remove(); };
  }, []);

  function press(event: MouseEvent<HTMLButtonElement>) {
    // Apply immediately; a pointer-transparent bloom never delays or queues taps.
    const next = toggled(chosen.current, window.matchMedia(DARK).matches);
    chosen.current = next;
    const root=document.documentElement;
    root.dataset.paletteUpdate="";
    try {
      flushSync(() => setTheme(next));
      applyTheme(root, next);
      // Settle the new palette without independent hover-color tweens leaving
      // controls briefly grey. Restore normal interaction motion in this same tap.
      void root.offsetWidth;
    } finally { delete root.dataset.paletteUpdate; }
    bloom.current?.remove();
    bloom.current = null;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const rect = event.currentTarget.getBoundingClientRect();
      const layer = document.createElement("div");
      layer.className = "theme-palette-bloom";
      layer.setAttribute("aria-hidden", "true");
      layer.style.setProperty("--bloom-x", `${rect.left + rect.width / 2}px`);
      layer.style.setProperty("--bloom-y", `${rect.top + rect.height / 2}px`);
      layer.dataset.palette = shown(next, window.matchMedia(DARK).matches);
      document.body.append(layer);
      bloom.current = layer;
      const motion = layer.animate([
        { clipPath:"circle(0px at var(--bloom-x) var(--bloom-y))", opacity:.35 },
        { clipPath:"circle(150vmax at var(--bloom-x) var(--bloom-y))", opacity:0 },
      ], { duration:180, easing:"cubic-bezier(.16,1,.3,1)" });
      motion.finished.then(() => { layer.remove(); if (bloom.current === layer) bloom.current=null; }).catch(() => layer.remove());
    }
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
      <svg className="theme-eclipse" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
        <path className="eclipse-moon" d="M20.5 13.2A8.5 8.5 0 0 1 10.8 3.5a8.5 8.5 0 1 0 9.7 9.7Z" />
        <g className="eclipse-rays"><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5" /></g>
        <circle className="eclipse-disc" cx="12" cy="12" r="6" />
        <g className="eclipse-orbit"><circle cx="21" cy="12" r="1" fill="currentColor" stroke="none" /></g>
      </svg>
    </button>
  );
}

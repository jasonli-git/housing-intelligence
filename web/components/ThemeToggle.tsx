"use client";

import { useEffect, useId, useRef, useState } from "react";
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
  const maskId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const transition = useRef<ViewTransition | null>(null);
  const chosen = useRef<Theme>("system");

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
    return () => query.removeEventListener("change", follow);
  }, []);

  async function press() {
    // Complete the previous palette update before another click chooses its opposite.
    const previous = transition.current;
    if (previous) {
      previous.skipTransition();
      await previous.updateCallbackDone.catch(() => {});
    }
    const next = toggled(chosen.current, window.matchMedia(DARK).matches);
    chosen.current = next;
    const root = document.documentElement;
    const update = () => {
      flushSync(() => setTheme(next));
      applyTheme(root, next);
    };
    if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const bounds = button.current?.getBoundingClientRect();
      const x = bounds ? bounds.left + bounds.width / 2 : innerWidth / 2;
      const y = bounds ? bounds.top + bounds.height / 2 : 0;
      root.style.setProperty("--theme-x", `${x}px`);
      root.style.setProperty("--theme-y", `${y}px`);
      root.style.setProperty("--theme-radius", `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
      root.dataset.themeReveal = "";
      const active = document.startViewTransition(update);
      transition.current = active;
      // A skipped/unsupported snapshot still applies the palette. Only its owner
      // cleans up, so rapid clicks cannot erase a newer reveal's styles.
      void active.finished.catch(() => {}).finally(() => {
        if (transition.current !== active) return;
        transition.current = null;
        delete root.dataset.themeReveal;
        ["--theme-x", "--theme-y", "--theme-radius"].forEach((key) => root.style.removeProperty(key));
      });
    } else {
      update();
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
    <button ref={button} type="button" className="bar-icon theme-toggle" onClick={press} aria-label={label} title={label}>
      <svg className="theme-eclipse" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
        <defs><mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="white" stroke="none" />
          <circle className="eclipse-shadow" cx="17" cy="7" r="6" fill="black" stroke="none" />
        </mask></defs>
        <g className="eclipse-rays"><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5" /></g>
        <circle className="eclipse-disc" cx="12" cy="12" r="6" mask={`url(#${maskId})`} />
        <g className="eclipse-orbit"><circle cx="21" cy="12" r="1" fill="currentColor" stroke="none" /></g>
      </svg>
    </button>
  );
}

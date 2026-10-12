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
  const button = useRef<HTMLButtonElement>(null);
  const reveal = useRef<ViewTransition | null>(null);
  const revision = useRef(0);

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
    // Root snapshots are painted above the live page and can target the root
    // instead of its button. Preserve this one visible control's hit area.
    const forwardTap = (event: PointerEvent) => {
      const control=button.current;
      if (!control || !document.documentElement.hasAttribute("data-theme-reveal") || event.composedPath().includes(control) || !event.isPrimary || event.button!==0) return;
      const rect=control.getBoundingClientRect();
      if(event.clientX>=rect.left && event.clientX<=rect.right && event.clientY>=rect.top && event.clientY<=rect.bottom) {
        event.preventDefault(); control.click();
      }
    };
    window.addEventListener("pointerup",forwardTap,true);
    return () => { query.removeEventListener("change", follow); window.removeEventListener("pointerup",forwardTap,true); reveal.current?.skipTransition(); delete document.documentElement.dataset.themeReveal; };
  }, []);

  function press(event: MouseEvent<HTMLButtonElement>) {
    // Interrupt, never await the previous reveal. Stale callbacks cannot apply a palette.
    const next = toggled(chosen.current, window.matchMedia(DARK).matches);
    chosen.current = next;
    const root=document.documentElement;
    const current = ++revision.current;
    reveal.current?.skipTransition();
    const apply = () => {
      if (revision.current !== current) return;
      root.dataset.paletteUpdate="";
      try { flushSync(() => setTheme(next)); applyTheme(root,next); void root.offsetWidth; }
      finally { delete root.dataset.paletteUpdate; }
    };
    if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const rect=event.currentTarget.getBoundingClientRect();
      root.style.setProperty("--theme-x",`${rect.left+rect.width/2}px`);
      root.style.setProperty("--theme-y",`${rect.top+rect.height/2}px`);
      root.dataset.themeReveal="";
      const transition=document.startViewTransition(apply);
      reveal.current=transition;
      transition.ready.catch(()=>{});
      transition.finished.catch(()=>{}).finally(()=>{
        if(revision.current===current) { delete root.dataset.themeReveal; root.style.removeProperty("--theme-x"); root.style.removeProperty("--theme-y"); reveal.current=null; }
      });
    } else { delete root.dataset.themeReveal; root.style.removeProperty("--theme-x"); root.style.removeProperty("--theme-y"); apply(); }
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
        <path className="eclipse-moon" d="M20.5 13.2A8.5 8.5 0 0 1 10.8 3.5a8.5 8.5 0 1 0 9.7 9.7Z" />
        <g className="eclipse-rays"><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5" /></g>
        <circle className="eclipse-disc" cx="12" cy="12" r="6" />
        <g className="eclipse-orbit"><circle cx="21" cy="12" r="1" fill="currentColor" stroke="none" /></g>
      </svg>
    </button>
  );
}

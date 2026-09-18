"use client";

import { type KeyboardEvent, useEffect, useState } from "react";

import { THEME_KEY, THEMES, type Theme, applyTheme, parseTheme } from "@/lib/theme";

const LABELS: Record<Theme, string> = {
  system: "Follow the system theme",
  light: "Light theme",
  dark: "Dark theme",
};

/** Monitor, sun and moon, drawn inline: three glyphs do not justify an icon library. */
function Icon({ theme }: { theme: Theme }) {
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" {...stroke}>
      {theme === "system" && (
        <>
          <rect x="2" y="2.5" width="12" height="8.5" rx="1.2" />
          <path d="M6 14h4M8 11v3" />
        </>
      )}
      {theme === "light" && (
        <>
          <circle cx="8" cy="8" r="2.8" />
          <path d="M8 1.5v1.4M8 13.1v1.4M1.5 8h1.4M13.1 8h1.4M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
        </>
      )}
      {theme === "dark" && <path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8Z" />}
    </svg>
  );
}

/**
 * The reader's theme: follow the system, light or dark (ARCHITECTURE #134).
 *
 * Three buttons rather than one that cycles, so every option and the current one are
 * visible before anything is pressed. A radiogroup, so it is one tab stop and the arrow
 * keys move the choice, as the New Jersey page's window control does.
 *
 * A stored choice is already on the page before this renders — the inline script in the
 * root layout applies it during parsing — so this only has to show it and change it.
 */
export function ThemeToggle() {
  // What the server rendered, and what a first visit is. The effect below corrects it
  // to a stored choice; the page's colors are already right by then.
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      setTheme(parseTheme(localStorage.getItem(THEME_KEY)));
    } catch {
      // Storage is blocked: the control stays on "system", which is what applies.
    }
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(document.documentElement, next);
    try {
      if (next === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {
      // The choice holds for this page even when it cannot be remembered.
    }
  }

  function onKeys(event: KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = THEMES[(THEMES.indexOf(theme) + step + THEMES.length) % THEMES.length];
    choose(next);
    event.currentTarget
      .querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [THEMES.indexOf(next)]?.focus();
  }

  return (
    <div className="theme" role="radiogroup" aria-label="Theme" onKeyDown={onKeys}>
      {THEMES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === theme}
          aria-label={LABELS[option]}
          title={LABELS[option]}
          tabIndex={option === theme ? 0 : -1}
          onClick={() => choose(option)}
        >
          <Icon theme={option} />
        </button>
      ))}
    </div>
  );
}

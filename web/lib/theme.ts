/**
 * The reader's theme: follow the system, or choose light or dark (ARCHITECTURE #134).
 *
 * Kept in `localStorage` under one key and applied as `data-theme` on `<html>`, which
 * `tokens.css` already honours: `:root[data-theme="dark"]` forces the dark palette, and
 * the media query's `:not([data-theme="light"])` lets a chosen light win over a dark
 * system. "system" is the absence of the attribute, so a reader who never touches the
 * control gets exactly what the site did before it existed.
 *
 * Pure, so the rules for a stored value are tested; the pre-paint script below applies
 * the same rules before React is on the page.
 */

export type Theme = "system" | "light" | "dark";

export const THEMES: readonly Theme[] = ["system", "light", "dark"];

export const THEME_KEY = "housing-theme";

/** A stored value as a theme. Anything unrecognised — or nothing — is "system". */
export function parseTheme(stored: string | null | undefined): Theme {
  return stored === "light" || stored === "dark" ? stored : "system";
}

type Root = {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
};

/** Put a theme on the document: an attribute for a choice, none for "system". */
export function applyTheme(root: Root, theme: Theme): void {
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

/**
 * Runs in `<head>` while the page is parsed, so a stored choice is on `<html>` before
 * the first paint and a returning reader never sees the other theme flash. Guarded,
 * because reading storage throws in some private windows and under blocked site data,
 * and the page must render regardless.
 */
export const THEME_SCRIPT =
  `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});` +
  `if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export type HousingMode = "state" | "afford";

export function housingModeAt(pathname: string, search: string): HousingMode {
  if (pathname === "/afford") return "afford";
  return new URLSearchParams(search).get("mode") === "afford" ? "afford" : "state";
}

/**
 * Runs beside the theme script, before the page paints. Static export cannot render a
 * query-string-specific tree, so this marks an affordability URL early enough for CSS
 * to hide the state workspace until React hydrates the matching mode.
 */
export const HOUSING_MODE_SCRIPT = `(()=>{try{const p=location.pathname;const q=new URLSearchParams(location.search);document.documentElement.dataset.housingMode=p==='/afford'||q.get('mode')==='afford'?'afford':'state'}catch{}})()`;

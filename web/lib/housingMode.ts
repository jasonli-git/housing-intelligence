export type HousingMode = "state" | "afford";

export function housingModeAt(pathname: string, search: string): HousingMode {
  if (pathname === "/afford") return "afford";
  return new URLSearchParams(search).get("mode") === "afford" ? "afford" : "state";
}

/**
 * Runs beside the theme script, before the page paints. Static export cannot render a
 * query-string-specific tree, so this marks an affordability URL early enough for CSS
 * to hide the state workspace until React hydrates the matching mode.
 *
 * An old `/?mode=afford` bookmark (#305) is sent on to `/afford` from here, before the
 * national entry paints, keeping any income it carried; `/` is a real page, so no
 * redirect rule can do it. Place pages forward theirs with `AffordForward`.
 */
export const HOUSING_MODE_SCRIPT = `(()=>{try{const p=location.pathname;const q=new URLSearchParams(location.search);if(p==='/'&&q.get('mode')==='afford'){q.delete('mode');const r=q.toString();location.replace('/afford'+(r?'?'+r:'')+location.hash);return}document.documentElement.dataset.housingMode=p==='/afford'||q.get('mode')==='afford'?'afford':'state'}catch{}})()`;

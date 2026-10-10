import routes from "./placeRoutes.json";
import { STATE_DESTINATIONS } from "./coverageMap";

/**
 * Public HTML addresses for places: `/<state>/<slug>`, e.g. `/nj/princeton`. The state
 * is part of every address because the platform is not New Jersey's alone: Essex County
 * and Princeton exist in several states, and a pinned address cannot be taken back once
 * published. API and data artifacts keep their numeric identifiers.
 */
type Route = { slug: string; state: string; geoid: string; level: string };
const records: Record<string, Route> = routes;
const byPath = new Map(Object.entries(records).map(([id, r]) => [`${r.state}/${r.slug}`, Number(id)]));

// Region ids that are pages of their own elsewhere: the nation is the home page, and a
// covered state has its own page. Neither is in the place registry.
const NATION_ID = 16828;
const STATE_IDS: Record<number, string> = { 1: "NJ" };

export function regionPath(id: number | string): string {
  const n = Number(id);
  if (n === NATION_ID) return "/";
  const state = STATE_IDS[n];
  if (state) return STATE_DESTINATIONS[state] ?? `/regions/${n}`;
  const r = records[String(n)];
  return r ? `/${r.state}/${r.slug}` : `/regions/${n}`;
}

/** The region id an address names, or null: never a guessed id for an unknown address. */
export function resolvePlace(state: string, slug: string): number | null {
  return byPath.get(`${state}/${slug}`) ?? null;
}

/** Only rewrite page/report URLs, never JSON, CSV, Markdown or API endpoints. */
export function readablePlaceHref(href: string): string {
  return href.replace(/^\/regions\/(\d+)(\/report)?(?=[?#]|$)/, (_, id, report = "") => {
    const path = regionPath(id);
    return path.startsWith("/regions/") || records[id] ? `${path}${report}` : path;
  });
}

/** One static page per place with data. Refuses a place with no pinned address, or one
 * whose geography changed under its id, rather than publish an unstable address. */
export function placeRouteParams(regions: { region_id: number; level: string; geoid: string }[]) {
  return regions.filter(r => r.level !== "state" && r.level !== "nation").map(r => {
    const record = records[r.region_id];
    if (!record) throw new Error(`No public address for region ${r.region_id}; run npm run routes:refresh and commit the registry.`);
    if (record.geoid !== r.geoid || record.level !== r.level) {
      throw new Error(`Geographic identity changed for region ${r.region_id}; refusing to reassign its public address.`);
    }
    return { state: record.state, place: record.slug };
  });
}

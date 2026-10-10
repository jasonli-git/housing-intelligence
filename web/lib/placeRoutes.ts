import routes from "./placeRoutes.json";

const records: Record<string, { slug: string; geoid: string; level: string }> = routes;
const slugs = Object.fromEntries(Object.entries(records).map(([id, r]) => [id, r.slug]));
const ids = new Map(Object.entries(slugs).map(([id, slug]) => [slug, Number(id)]));

/** Public HTML addresses only. API/data artifacts keep their numeric identifiers. */
export function regionPath(id: number | string): string {
  return Number(id) === 1 ? "/states/new-jersey" : `/regions/${slugs[String(id)] ?? id}`;
}

export function resolveRegionId(segment: string): number | null {
  if (/^[1-9]\d*$/.test(segment)) return slugs[segment] ? Number(segment) : null;
  return ids.get(segment) ?? null;
}

/** Only rewrite page/report URLs, never JSON, CSV, Markdown or API endpoints. */
export function readablePlaceHref(href: string): string {
  return href.replace(/^\/regions\/(\d+)(\/report)?(?=[?#]|$)/, (_, id, report = "") => `${regionPath(id)}${Number(id) === 1 ? "" : report}`);
}

export function placeRouteParams(regions: { region_id: number; level: string; geoid: string }[]) {
  return regions.filter(r => r.level !== "state").flatMap(r => {
    const slug = slugs[r.region_id];
    if (!slug) throw new Error(`No public slug for region ${r.region_id}; run npm run routes:refresh and commit the registry.`);
    if (records[r.region_id].geoid !== r.geoid || records[r.region_id].level !== r.level) {
      throw new Error(`Geographic identity changed for region ${r.region_id}; refusing to reassign its public address.`);
    }
    // Full legacy copies multiply Next's segment files beyond the Pages free-plan cap.
    // Production aliases are tiny HTML redirect pages written after the export.
    return [{ id: slug }, ...(process.env.NODE_ENV === "development" ? [{ id: String(r.region_id) }] : [])];
  });
}

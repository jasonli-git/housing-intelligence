import { api, regionsWithData } from "@/lib/api";
import { pack, type PackedOutline } from "@/lib/mapdata";
import type { AtlasLevel } from "@/lib/housingAtlas";

/**
 * The housing map's outlines, at two levels of detail (Milestone 66, ARCHITECTURE #523).
 *
 * The whole state is drawn from a light file and, from `DETAIL_ZOOM` in, from a detailed
 * one fetched then. One file at one tolerance (0.0005°, to 2026-11-21) was more detail
 * than the whole state shows, about a fifth of a pixel, and too little close up, where
 * town lines went visibly straight. Simplification is in degrees: at the opening view a
 * pixel is about 0.003°, so the light file's 0.001° is a third of one; at 8× it is about
 * 0.0004°, which the detailed file's 0.0001° keeps under.
 */
export const TOLERANCE: Record<AtlasLevel, { light: number; detail: number }> = {
  county: { light: 0.001, detail: 0.0002 },
  municipality: { light: 0.001, detail: 0.0001 },
  zip: { light: 0.001, detail: 0.0001 },
};

/** The level's outlines at one detail, keyed by region. */
export async function atlasOutlines(level: AtlasLevel, detail: "light" | "detail", state = "NJ"): Promise<PackedOutline[]> {
  const tolerance = TOLERANCE[level][detail];
  if (level !== "municipality") {
    const geometry = await api.geo(level, state, tolerance);
    return geometry ? pack(geometry, "region_id") : [];
  }
  // A covered state's towns (Director Note "Visualizing the data", 2026-10-22; every
  // covered state since Milestone 63).
  const [geometry, regions] = await Promise.all([api.geo("municipality", state, tolerance), regionsWithData()]);
  if (!geometry) return [];
  // A name several towns share carries its county, "Franklin township (Somerset)", as the
  // place search does (lib/search.ts `shownNames`).
  const county = new Map(regions.filter((r) => r.level === "county").map((r) => [r.region_id, r.name.replace(/ County$/, "")]));
  const parent = new Map(regions.map((r) => [r.region_id, r.parent_id]));
  const label = (p: Record<string, unknown>) => String(p.name_lsad ?? p.name);
  const count = new Map<string, number>();
  for (const f of geometry.features) count.set(label(f.properties), (count.get(label(f.properties)) ?? 0) + 1);
  for (const f of geometry.features) {
    const where = county.get(parent.get(Number(f.properties.region_id)) ?? -1);
    if ((count.get(label(f.properties)) ?? 0) > 1 && where) f.properties.name_lsad = `${label(f.properties)} (${where})`;
  }
  return pack(geometry, "region_id");
}

/**
 * The figures the visual stories are built from, read from the build's API. Server-only:
 * each story page awaits these and hands plain rows to its chart.
 */
import { api } from "@/lib/api";
import { centre, inside, PRICE, TRAITS, type Place, type StoryTown } from "@/lib/stories";

const TOWN_METRICS = [PRICE, "zhvi_bottom_tier", "sr1a_median_sale_price", ...TRAITS.map((t) => t.metric)];

export async function storyCounties(): Promise<Map<number, string>> {
  const counties = await api.regions("level=county&state=NJ&limit=100");
  return new Map((counties?.items ?? []).map((c) => [c.region_id, c.name.replace(/ County$/, "")]));
}

/** Every New Jersey town with its county and the latest value of each story measure. */
export async function storyTowns(): Promise<StoryTown[]> {
  const [counties, towns, ...values] = await Promise.all([
    storyCounties(),
    api.regions("level=municipality&state=NJ&limit=1000"),
    ...TOWN_METRICS.map((m) => api.values(m, "municipality", 1000)),
  ]);
  // Ranked measures come from their value ranking; the rest (rail access, NYC jobs and
  // others no ranking holds) from their series, in batches of towns, latest period each.
  const ids = (towns?.items ?? []).map((t) => t.region_id);
  const byMetric = await Promise.all(
    TOWN_METRICS.map(async (m, i) => {
      const ranked = values[i]?.items ?? [];
      if (ranked.length) return [m, new Map(ranked.map((r) => [r.region_id, r.value]))] as const;
      const latest = new Map<number, number>();
      for (let start = 0; start < ids.length; start += 150) {
        const body = await api.costObservations(m, ids.slice(start, start + 150));
        for (const region of body?.regions ?? []) {
          const last = region.series.at(-1);
          if (last && Number.isFinite(last.value)) latest.set(region.region_id, last.value);
        }
      }
      return [m, latest] as const;
    }),
  );
  return (towns?.items ?? []).map((t) => ({
    id: t.region_id,
    name: t.name_lsad ?? t.name,
    county: t.parent_id ?? -1,
    countyName: counties.get(t.parent_id ?? -1) ?? "",
    values: Object.fromEntries(byMetric.flatMap(([m, map]) => (map.has(t.region_id) ? [[m, map.get(t.region_id)!]] : []))),
  }));
}

/**
 * ZIP codes with their typical home value and the county holding their centre: a ZIP code
 * is a mail route, not part of a county, and one that crosses a county line is placed by
 * where its middle falls.
 */
export async function storyZips(): Promise<(Place & { county: number | null })[]> {
  const [values, zipGeo, countyGeo] = await Promise.all([api.values(PRICE, "zip", 1000), api.geo("zip", "NJ", 0.001), api.geo("county", "NJ", 0.001)]);
  type Feature = { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } };
  const rings = (f: Feature): number[][] => {
    const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
    return polys.flatMap((p) => p.map((ring) => ring.flat()));
  };
  const counties = ((countyGeo?.features ?? []) as Feature[]).map((f) => ({ id: Number(f.properties.region_id), rings: rings(f) }));
  const where = new Map(((zipGeo?.features ?? []) as Feature[]).map((f) => {
    const point = centre(rings(f));
    return [Number(f.properties.region_id), counties.find((c) => inside(point, c.rings))?.id ?? null] as const;
  }));
  return (values?.items ?? []).map((r) => ({ id: r.region_id, name: r.name, value: r.value, county: where.get(r.region_id) ?? null }));
}

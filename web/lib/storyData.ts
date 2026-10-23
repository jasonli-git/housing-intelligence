/**
 * The figures the visual stories are built from, read from the build's API. Server-only:
 * each story page awaits these and hands plain rows to its chart.
 */
import { api, type Region } from "@/lib/api";
import { centre, inside, PRICE, TRAITS, type Place, type StoryTown } from "@/lib/stories";
import { shapes, type Projector, type Shape } from "@/lib/storyMap";

const TOWN_METRICS = [PRICE, "zhvi_bottom_tier", "sr1a_median_sale_price", ...TRAITS.map((t) => t.metric)];

export async function storyCounties(): Promise<Map<number, string>> {
  const counties = await api.regions("level=county&state=NJ&limit=100");
  return new Map((counties?.items ?? []).map((c) => [c.region_id, c.name.replace(/ County$/, "")]));
}

export async function storyTownRegions(): Promise<Region[]> {
  return (await api.regions("level=municipality&state=NJ&limit=1000"))?.items ?? [];
}

/** Each region's full yearly series of one measure, oldest first, in batches of regions. */
export async function seriesFor(metric: string, ids: number[]): Promise<Map<number, { year: number; value: number }[]>> {
  const out = new Map<number, { year: number; value: number }[]>();
  for (let start = 0; start < ids.length; start += 150) {
    const body = await api.costObservations(metric, ids.slice(start, start + 150));
    for (const region of body?.regions ?? []) {
      out.set(region.region_id, region.series.filter((o) => Number.isFinite(o.value)).map((o) => ({ year: Number(o.period_start.slice(0, 4)), value: o.value })));
    }
  }
  return out;
}

/**
 * The latest value of each measure for the given regions. Ranked measures come from their
 * value ranking; the rest (rail access, NYC jobs and others no ranking holds) from their
 * series, latest period each.
 */
export async function latestFor(metrics: string[], level: string, ids: number[]): Promise<Map<number, Partial<Record<string, number>>>> {
  const byMetric = await Promise.all(
    metrics.map(async (m) => {
      const ranked = (await api.values(m, level, 1000))?.items ?? [];
      if (ranked.length) return [m, new Map(ranked.map((r) => [r.region_id, r.value]))] as const;
      const series = await seriesFor(m, ids);
      return [m, new Map([...series].flatMap(([id, s]) => (s.length ? [[id, s.at(-1)!.value] as const] : [])))] as const;
    }),
  );
  return new Map(ids.map((id) => [id, Object.fromEntries(byMetric.flatMap(([m, map]) => (map.has(id) ? [[m, map.get(id)!]] : [])))]));
}

/** Every New Jersey town with its county and the latest value of each measure asked for. */
export async function storyTowns(metrics: string[] = TOWN_METRICS): Promise<StoryTown[]> {
  const [counties, towns] = await Promise.all([storyCounties(), storyTownRegions()]);
  const values = await latestFor(metrics, "municipality", towns.map((t) => t.region_id));
  return towns.map((t) => ({
    id: t.region_id,
    name: t.name_lsad ?? t.name,
    county: t.parent_id ?? -1,
    countyName: counties.get(t.parent_id ?? -1) ?? "",
    values: values.get(t.region_id) ?? {},
  }));
}

/** Runs `fn` over every item, a few at a time, so a story reading every town does not flood the API. */
export async function each<T, R>(items: T[], fn: (item: T) => Promise<R>, at = 8): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(at, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

/** New Jersey's counties or towns as map paths, `width` wide; towns share the counties' frame. */
export async function storyShapes(level: "county" | "municipality", width: number): Promise<{ shapes: Shape[]; projector: Projector }> {
  type Feature = Parameters<typeof shapes>[0][number];
  const counties = ((await api.geo("county", "NJ", 0.001))?.features ?? []) as unknown as Feature[];
  const frame = shapes(counties, width);
  if (level === "county") return frame;
  const towns = ((await api.geo("municipality", "NJ", 0.0005))?.features ?? []) as unknown as Feature[];
  return shapes(towns, width, frame.projector);
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

import type { Observation, PacketLevel, PacketMetric, Region } from "./api";

export type MarketPeer = { id: number; name: string; value: number };
export type MarketPoint = { date: string; value: number };
export type MarketCohort = { metricId: string; period: string; total: number; points: MarketPeer[] };
export type MarketComparison = { regions: { region_id: number; series: { period_start: string; value: number }[] }[] };

/** A value axis needs same-period observations, not the latest-value ranking. */
export function matchedMarketPeers(data: MarketComparison, regions: Region[], period: string, counties: Region[] = []): MarketPeer[] {
  const registry = new Map(regions.map(r => [r.region_id, r]));
  const seen = new Set<number>();
  return data.regions.flatMap(row => {
    const region = registry.get(row.region_id);
    if (!region) return [];
    if (seen.has(row.region_id)) throw new Error("Duplicate town in market comparison");
    seen.add(row.region_id);
    const points = row.series.filter(p => p.period_start === period);
    if (points.length > 1) throw new Error("Duplicate month in market comparison");
    const point = points[0];
    if (!point || !Number.isFinite(point.value) || point.value <= 0) return [];
    const name = region.name_lsad ?? region.name;
    const repeated = regions.some(r => r.region_id !== region.region_id && (r.name_lsad ?? r.name) === name);
    const county = counties.find(c => c.region_id === region.parent_id);
    return [{ id: row.region_id, name: repeated && county ? `${name} · ${county.name_lsad ?? county.name}` : name, value: point.value }];
  }).sort((a, b) => a.value - b.value || a.id - b.id);
}

export function marketHistory(row: PacketLevel, observations: Observation[], change?: PacketMetric): MarketPoint[] {
  const from = change?.window_start ?? `${Number(row.period_end.slice(0, 4)) - 5}${row.period_end.slice(4)}`;
  const points = observations.filter(p => p.metric_id === row.metric_id && (!row.source_id || p.source_id === row.source_id)
    && p.period_end >= from && p.period_end <= row.period_end && Number.isFinite(p.value) && p.value > 0)
    .map(p => ({ date: p.period_end, value: p.value })).sort((a, b) => a.date.localeCompare(b.date));
  if (new Set(points.map(p => p.date)).size !== points.length) throw new Error("Duplicate month in market history");
  // Do not attach a history to a headline from another date or revision.
  const end = points.at(-1);
  return end?.date === row.period_end && Math.abs(end.value - row.value) < .01 ? points : [];
}

/** Explicit breaks rather than a line drawn through missing months. */
export function marketLine(points: MarketPoint[], x: (date: string) => number, y: (value: number) => number): string {
  return points.map((p, i) => `${i === 0 || Date.parse(p.date) - Date.parse(points[i - 1].date) > 45 * 86400000 ? "M" : "L"}${x(p.date).toFixed(2)},${y(p.value).toFixed(2)}`).join(" ");
}

import { api, type PacketLevel } from "./api";
import { matchedMarketPeers, type MarketCohort } from "./marketPortrait";

/** Local prototype only. No extra browser fetch or new published artifact. */
export async function marketPortraitData(state: string, levels: PacketLevel[], level = "municipality"): Promise<MarketCohort[]> {
  // A place is set among places of its own kind: towns, counties or ZIP codes.
  const [towns, counties] = await Promise.all([
    api.regions(`state=${encodeURIComponent(state)}&level=${level}&limit=1000`),
    api.regions(`state=${encodeURIComponent(state)}&level=county&limit=1000`),
  ]);
  if (!towns) return [];
  if (towns.total !== towns.items.length) throw new Error("Market portrait town registry is incomplete");
  return Promise.all(levels.filter(l => ["zhvi_sfr", "zori_all"].includes(l.metric_id)).map(async row => {
    // Bound URLs and API work even if the geographic registry grows.
    const batches = [];
    for (let i = 0; i < towns.items.length; i += 100) batches.push(towns.items.slice(i, i + 100));
    const parts = await Promise.all(batches.map(batch => api.marketObservations(row.metric_id, batch.map(r => r.region_id), row.period_start)));
    if (parts.some(p => p === null)) return { metricId: row.metric_id, period: row.period_start, total: towns.total, points: [] };
    return { metricId: row.metric_id, period: row.period_start, total: towns.total,
      points: matchedMarketPeers({ regions: parts.flatMap(p => p!.regions) }, towns.items, row.period_start, counties?.items) };
  }));
}

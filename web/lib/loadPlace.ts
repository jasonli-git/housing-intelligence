import type { CommunityContext, Observation, Packet, Utilities, WaterSystems } from "@/lib/api";
import type { GuideData } from "@/lib/guide";
import type { IncomeLimits } from "@/lib/household";

/**
 * One place's published files, read in the browser, as the briefing needs them
 * (Milestone 49's guide loader; ARCHITECTURE #330). `?place=<region id>` names the place,
 * so one page serves every place instead of one file per place.
 */
async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function loadPlace(artifactUrl: string, id: number, newest: Record<string, string | null>): Promise<GuideData | null> {
  const base = `${artifactUrl}/regions/${id}`;
  const [packet, metrics, incomeLimits, water, community, utilities] = await Promise.all([
    getJson<Packet>(`${base}/packet/5y.json`),
    getJson<{ total: number; observations: Observation[] }>(`${base}/metrics.json`),
    getJson<IncomeLimits>(`${base}/income-limits.json`),
    getJson<WaterSystems>(`${base}/water-systems.json`),
    getJson<CommunityContext>(`${base}/community.json`),
    getJson<Utilities>(`${base}/utilities.json`),
  ]);
  if (!packet) return null;
  // FHA's limit and the county's turnover are the county's: a town or ZIP reads its
  // county's packet, the county HUD's income limits were set for.
  const countyId =
    packet.region.level === "county"
      ? null
      : (incomeLimits?.county_id ?? (packet.region.parent?.level === "county" ? packet.region.parent.region_id : null));
  const county = countyId ? await getJson<Packet>(`${artifactUrl}/regions/${countyId}/packet/5y.json`) : null;
  const series = (metric: string) => (metrics?.observations ?? []).filter((o) => o.metric_id === metric).sort((a, b) => a.period_start.localeCompare(b.period_start));
  return {
    region: packet.region,
    levels: packet.levels,
    countyLevels: county?.levels ?? [],
    sources: packet.sources,
    incomeLimits,
    turnover: (metrics?.observations ?? [])
      .filter((o) => o.metric_id === "sr1a_turnover_per_1000")
      .sort((a, b) => a.period_start.localeCompare(b.period_start)),
    water,
    community,
    utilities,
    newest,
    floodClaims: series("fema_flood_claims"),
    noise: { over55: series("noise_homes_share_55db").at(-1) ?? null, over65: series("noise_homes_share_65db").at(-1) ?? null },
  };
}

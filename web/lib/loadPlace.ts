import { api, type Observation } from "@/lib/api";
import type { GuideData } from "@/lib/guide";

/**
 * One place's figures, as the briefing needs them (Milestone 49's guide loader, #330).
 *
 * Read from the API at build time since Milestone 62 (ARCHITECTURE #521): a town's
 * briefing is its own page, rendered into the static export, so the slides are in the
 * HTML a search engine or a link preview reads. Until then the browser read the same
 * figures from the published artifacts after the page loaded. The build cannot read the
 * artifact host instead: `make publish` uploads the artifacts after the pages are built,
 * so the host still holds the previous publish while this runs.
 */
export async function loadPlace(id: number, newest: Record<string, string | null>): Promise<GuideData | null> {
  const [packet, metrics, incomeLimits, water, community, utilities] = await Promise.all([
    api.packet(id, "5y"),
    api.regionObservations(id),
    api.incomeLimits(id),
    api.waterSystems(id),
    api.community(id),
    api.utilities(id),
  ]);
  if (!packet) return null;
  // FHA's limit and the county's turnover are the county's: a town or ZIP reads its
  // county's packet, the county HUD's income limits were set for.
  const countyId =
    packet.region.level === "county"
      ? null
      : (incomeLimits?.county_id ?? (packet.region.parent?.level === "county" ? packet.region.parent.region_id : null));
  const county = countyId ? await api.packet(countyId, "5y") : null;
  const observations: Observation[] = metrics?.observations ?? [];
  const series = (metric: string) => observations.filter((o) => o.metric_id === metric).sort((a, b) => a.period_start.localeCompare(b.period_start));
  return {
    region: packet.region,
    levels: packet.levels,
    countyLevels: county?.levels ?? [],
    sources: packet.sources,
    incomeLimits,
    turnover: series("sr1a_turnover_per_1000"),
    water,
    community,
    utilities,
    newest,
    floodClaims: series("fema_flood_claims"),
    noise: { over55: series("noise_homes_share_55db").at(-1) ?? null, over65: series("noise_homes_share_65db").at(-1) ?? null },
  };
}

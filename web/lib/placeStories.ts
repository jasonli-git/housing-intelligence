import type { CommunityContext, HousingPressure, Inquiry, Migration, Observation, PacketLevel, PacketMetric, Persistence, Region, Utilities, WaterSystems, WorkDestinations } from "./api";
import { displayName } from "./names";
import { formatMetric, formatValue } from "./format";
import { marginLabel } from "./uncertainty";
import { surveyYears } from "./periods";
import { marketStorySummary } from "./marketPlaceStories";
import { livingStorySummary } from "./livingPlaceStories";
import type { FloodStoryData } from "./placeFloodStory";

export const PLACE_STORIES = {
  market: { slug: "income-and-home-value", title: "Prices & paychecks" },
  past: { slug: "is-today-unusual", title: "County market history" },
  sales: { slug: "price-ladder", title: "The homes that sold" },
  pressure: { slug: "who-feels-housing-costs", title: "Housing cost burden" },
  lending: { slug: "the-mortgage-market", title: "Buyer financing" },
  building: { slug: "is-new-jersey-building", title: "Building & demolition" },
  migration: { slug: "who-moves-in", title: "County arrivals & departures" },
  commute: { slug: "the-long-commute-premium", title: "Getting around" },
  water: { slug: "water-you-can-check", title: "Water you can check" },
  flood: { slug: "the-flood-claims-calendar", title: "Flood exposure & claims" },
  sites: { slug: "sites-and-cleanup", title: "Sites & cleanup" },
  utilities: { slug: "when-the-power-goes-out", title: "Power & reliability" },
  broadband: { slug: "where-internet-reaches", title: "Internet availability" },
} as const;
export type PlaceStoryTopic = keyof typeof PLACE_STORIES;
export type PlaceStoryRecord = {
  topic: PlaceStoryTopic;
  place: Pick<Region, "region_id" | "name" | "level" | "state_code"> & { geoid?: string; county_id?: number };
  levels: PacketLevel[];
  metrics: PacketMetric[];
  history: { metricId: string; observations: Observation[] }[];
  water: WaterSystems | null;
  destinations: WorkDestinations | null;
  pressure?: HousingPressure | null;
  migration?: Migration | null;
  countyHistory?: { region_id: number; name: string; data: Persistence | null } | null;
  flood?: FloodStoryData | null;
  utilities?: Utilities | null;
  utilityInquiry?: Inquiry | null;
  community?: CommunityContext | null;
  snapshot: string;
};
export const STORY_HISTORY_METRICS = {
  market: ["zhvi_sfr", "zori_all", "acs_median_hh_income"],
  building: ["permits_total_units", "nj_units_certified", "nj_units_demolished", "nj_net_units_added"],
} as const;
export function storyHistoryMetrics(topic: PlaceStoryTopic): readonly string[] {
  return topic === "market" || topic === "building" ? STORY_HISTORY_METRICS[topic] : [];
}
export type PlaceStorySummary = {
  available: boolean; headline: string; period: string; source: string; qualifier: string;
  rows: { label: string; value: number; formatted: string; margin?: string; aside?: string }[];
};
export const placeStoryHref = (topic: PlaceStoryTopic, id: number) => `/stories/${PLACE_STORIES[topic].slug}?place=${id}`;
export function storyPlaceId(search: string): number | null {
  const value = new URLSearchParams(search).get("place");
  return value && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
}
export function makePlaceStoryRecord(topic: PlaceStoryTopic, place: PlaceStoryRecord["place"], levels: PacketLevel[], extra: Partial<Pick<PlaceStoryRecord, "metrics" | "history" | "water" | "destinations" | "pressure" | "migration" | "countyHistory" | "flood" | "utilities" | "utilityInquiry" | "community">> = {}): PlaceStoryRecord {
  const countyHistory = extra.countyHistory;
  const keep = (id: string) => topic === "market" ? ["acs_median_home_value", "acs_median_hh_income", "zhvi_sfr", "zori_all"].includes(id)
    : topic === "commute" ? /^(acs_(mean_commute|commute_|work_from_home)|lodes_|transit_)/.test(id)
    : topic === "sales" ? /^(sr1a_|nj_director_ratio$|nj_revaluation_year$|sale_price_to_income$)/.test(id)
    : topic === "lending" ? id.startsWith("hmda_")
    : topic === "building" ? /^(permits_|nj_units_|nj_net_|nj_certificates_|nj_demolitions_)/.test(id)
    : topic === "sites" ? id.startsWith("njdep_sites_")
    : topic === "flood" ? /^(fema_|njdep_tidal_)/.test(id)
    : topic === "water" && id.startsWith("water_");
  return { topic, place, levels: levels.filter(l => keep(l.metric_id)), metrics: extra.metrics ?? [], history: (extra.history ?? []).map(s => ({ metricId: s.metricId, observations: s.observations })),
    water: extra.water?.region_id === place.region_id && Array.isArray(extra.water.systems) ? extra.water : null,
    destinations: extra.destinations?.region_id === place.region_id && Array.isArray(extra.destinations.destinations) ? extra.destinations : null,
    ...(topic === "pressure" ? { pressure: extra.pressure?.region_id === place.region_id && Array.isArray(extra.pressure.bands) ? extra.pressure : null } : {}),
    ...(topic === "migration" ? { migration: extra.migration?.region_id === place.region_id && Array.isArray(extra.migration.years) ? extra.migration : null } : {}),
    ...(topic === "past" ? { countyHistory: countyHistory && countyHistory.region_id === (place.level === "county" ? place.region_id : place.county_id) && countyHistory.data?.region_id === countyHistory.region_id ? countyHistory : null } : {}),
    ...(topic === "flood" ? { flood:extra.flood?.region_id === place.region_id ? extra.flood : null } : {}),
    ...(topic === "utilities" ? { utilities:extra.utilities?.region_id === place.region_id ? extra.utilities : null, utilityInquiry:extra.utilityInquiry ?? null } : {}),
    ...(topic === "broadband" ? { community:extra.community?.region_id === place.region_id ? {...extra.community,districts:[],health:[],crime:[]} : null } : {}), snapshot: "" };
}
export function summarizePlaceStory(record: PlaceStoryRecord): PlaceStorySummary {
  const unavailable: PlaceStorySummary = { available: false, headline: "Local records unavailable", period: "No matching period", source: "Coverage limited", qualifier: "Missing data is not a zero or a clean result.", rows: [] };
  const row = (id: string) => record.levels.find(l => l.metric_id === id && Number.isFinite(l.value) && typeof l.period_start === "string" && typeof l.period_end === "string" && /^\d{4}-\d{2}-\d{2}$/.test(l.period_start) && /^\d{4}-\d{2}-\d{2}$/.test(l.period_end));
  const chartRow = (l: PacketLevel, label: string) => ({ label, value: l.value, formatted: formatMetric(l.value, l.unit, l.metric_id), margin: marginLabel(l.value, l.margin_of_error ?? null, l.unit, l.metric_id) ?? undefined });
  const additional = marketStorySummary(record);
  if (additional) return additional;
  const living = livingStorySummary(record);
  if (living) return living;
  if (record.topic === "market") {
    const home = row("acs_median_home_value"), income = row("acs_median_hh_income");
    if (!home || !income || home.value <= 0 || income.value <= 0 || home.period_start !== income.period_start || home.period_end !== income.period_end) return unavailable;
    return { available: true, headline: `${formatValue(home.value, "usd")} owner-reported home value`, period: surveyYears(home.period_start, home.period_end), source: "Census ACS",
      qualifier: "Survey medians, not current asking prices or a personal affordability test. Margins shown are 90%.",
      rows: [chartRow(home, "Owner-reported home value"), chartRow(income, "Annual household income, before tax")] };
  }
  if (record.topic === "commute") {
    const mean = row("acs_mean_commute_minutes");
    if (!mean || mean.value < 0) return unavailable;
    const modes = [["acs_commute_drove_alone_share", "Drive alone"], ["acs_commute_transit_share", "Public transit"], ["acs_commute_walked_share", "Walk"], ["acs_work_from_home_share", "Work from home"]];
    return { available: true, headline: `${Math.round(mean.value)}-minute average commute`, source: "Census ACS", period: surveyYears(mean.period_start, mean.period_end),
      qualifier: `Mean one-way journey for people who travel to work—not your route. 90% margin: ${marginLabel(mean.value, mean.margin_of_error ?? null, mean.unit, mean.metric_id)}. Modes are shares of working residents; categories shown are not exhaustive.`,
      rows: modes.flatMap(([id, label]) => { const l = row(id); return l && l.period_start === mean.period_start && l.period_end === mean.period_end && l.value >= 0 && l.value <= 1 ? [chartRow(l, label)] : []; }) };
  }
  const water = record.water;
  if (!water || !water.systems.length) return unavailable;
  if (water.region_id !== record.place.region_id || new Set(water.systems.map(s => s.pwsid)).size !== water.systems.length) return unavailable;
  if (water.systems.some(s => !Number.isFinite(s.violations) || s.violations < 0 || !Number.isFinite(s.homes) || s.homes < 0)) return unavailable;
  const systems = water.systems, violations = systems.filter(s => s.violations > 0).length;
  return { available: true, headline: `${violations} of ${systems.length} water systems with past health-based violations`, period: `${water.first_year}–${water.last_year}`, source: "EPA / NJDEP",
    qualifier: "System-wide history, not today’s tap water or affected-home counts. Bars show estimated homes served here; private wells are not covered.",
    rows: [...systems].sort((a, b) => b.homes - a.homes).map(s => ({ label: s.name, value: s.homes, formatted: `${formatValue(s.homes, "count")} homes`, aside: `${s.violations} recorded violation${s.violations === 1 ? "" : "s"}` })) };
}
export const placeStoryName = (record: PlaceStoryRecord) => displayName(record.place);

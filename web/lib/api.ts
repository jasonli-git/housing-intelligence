/**
 * Typed access to the read-only analytics API.
 *
 * Server-side only: pages fetch here during render, so no request goes out from the
 * browser and first paint carries real data. `cache: "no-store"` because the warehouse
 * changes when the pipeline runs, not on a schedule Next could revalidate on.
 *
 * One exception, and it is explicit: `publicApiUrl` is rendered into the Markdown
 * export link, which the browser follows to the API directly. That is a URL in an
 * href, not a fetcher shipped to the client.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Region = {
  region_id: number;
  geoid: string;
  level: string;
  name: string;
  state_code: string;
  parent_id: number | null;
};

export type Headline = {
  metric_id: string;
  label: string;
  unit: string;
  direction: string;
  window: string;
  start_value: number;
  end_value: number;
  pct_change: number;
  rank: number | null;
  of: number | null;
};

export type Summary = {
  region_id: number;
  name: string;
  level: string;
  window: string;
  headlines: Headline[];
  caveats: string[];
};

export type RankedRegion = {
  rank: number;
  of: number;
  percentile: number;
  region_id: number;
  name: string;
  level: string;
  pct_change: number;
  start_value: number;
  end_value: number;
  window_start: string;
  window_end: string;
};

export type Ranking = {
  metric_id: string;
  label: string;
  direction: string;
  window: string;
  level: string;
  items: RankedRegion[];
};

export type Observation = {
  metric_id: string;
  period_start: string;
  period_end: string;
  value: number;
  source_id: string;
  vintage: string;
  match_method: string;
};

/**
 * The analysis packet, mirroring `schemas/packet-v1.json`. Hand-written rather than
 * generated: one file, and a generator in the build would be a dependency for less
 * than a hundred lines. `packet_version` is what a consumer checks before trusting
 * the shape — bump it here when the published schema's major version changes.
 */
export type PacketMetric = {
  metric_id: string;
  label: string;
  unit: string;
  direction: string;
  window_start: string;
  window_end: string;
  start_value: number;
  end_value: number;
  pct_change: number;
  cagr: number | null;
  rank: number | null;
  of: number | null;
  percentile: number | null;
  release_id: number | null;
  source_id: string | null;
  match_method: string | null;
};

export type Packet = {
  packet_version: string;
  region: {
    region_id: number;
    geoid: string;
    level: string;
    name: string;
    label: string;
    state_code: string;
    parent: { region_id: number; name: string; level: string } | null;
  };
  window: { label: string; start: string; end: string };
  metrics: PacketMetric[];
  comparisons: { peer_level: string; peer_scope: string; peer_count: number };
  highlights: {
    metric_id: string;
    label: string;
    position: "leading" | "trailing";
    rank: number;
    of: number;
    pct_change: number;
  }[];
  caveats: string[];
  sources: {
    source_id: string;
    name: string;
    publisher: string;
    license: string;
    url: string;
    vintage: string;
    fetched_at: string;
    release_ids: number[];
  }[];
};

export type Feature = {
  type: "Feature";
  id: number;
  geometry: { type: string; coordinates: number[][][] | number[][][][] };
  properties: { region_id: number; geoid: string; name: string; level: string };
};

export type FeatureCollection = { type: "FeatureCollection"; features: Feature[] };

/** Returns null when the API is unreachable, so a page renders a message not a crash. */
async function tryGet<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${path}`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export const api = {
  regions: (query: string) =>
    tryGet<{ total: number; items: Region[] }>(`/regions?${query}`),
  region: (id: number) => tryGet<Region & { ancestors: Region[] }>(`/regions/${id}`),
  summary: (id: number, window: string) =>
    tryGet<Summary>(`/regions/${id}/summary?window=${window}`),
  rankings: (metricId: string, level: string, window: string, limit = 25) =>
    tryGet<Ranking>(
      `/rankings?metric_id=${metricId}&level=${level}&window=${window}&limit=${limit}`,
    ),
  observations: (id: number, metricId: string) =>
    tryGet<{ observations: Observation[] }>(
      `/regions/${id}/metrics?metric_id=${metricId}`,
    ),
  packet: (id: number, window: string) =>
    tryGet<Packet>(`/regions/${id}/packet?window=${window}`),
  geo: (level: string) => tryGet<FeatureCollection>(`/geo/${level}?state=NJ`),
};

/**
 * The API's public origin, for links the *browser* follows — the Markdown export is
 * a direct download from the API, not a page this app renders. Everything else in
 * this module is fetched during server render, which is why `API_URL` otherwise stays
 * off the client.
 */
export const publicApiUrl = API_URL;

export { formatValue, formatChange } from "./format";

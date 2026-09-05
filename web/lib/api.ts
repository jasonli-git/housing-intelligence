/**
 * Typed access to the read-only analytics API.
 *
 * Server-side only: pages fetch here during render, so no request goes out from the
 * browser and first paint carries real data.
 *
 * Under `output: "export"` that render happens once, at build time, against an API the
 * build starts and then stops. `cache: "no-store"` used to be set here because the
 * warehouse changes when the pipeline runs rather than on a schedule; it is gone now
 * because it forces dynamic rendering, which a static export cannot do. Freshness is a
 * property of *when the build ran*, which is the same thing the artifact manifest
 * records.
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

/** A metric's most recent value and its rank by value, not by change. */
export type LevelReading = {
  metric_id: string;
  label: string;
  unit: string;
  direction: string;
  value: number;
  period_start: string;
  period_end: string;
  source_id: string;
  rank: number | null;
  of: number | null;
};

export type Summary = {
  region_id: number;
  name: string;
  level: string;
  window: string;
  headlines: Headline[];
  /** Every metric with an observation, including snapshot-only ones like MOD-IV. */
  levels: LevelReading[];
  caveats: string[];
};

export type RankedRegion = {
  rank: number;
  of: number;
  percentile: number;
  region_id: number;
  name: string;
  level: string;
  /** The quantity ranked: a percentage change under basis=change, a level otherwise. */
  value: number;
  // Null for a value ranking, which has no window and no starting point.
  pct_change: number | null;
  start_value: number | null;
  end_value: number | null;
  window_start: string | null;
  window_end: string | null;
};

export type Ranking = {
  metric_id: string;
  label: string;
  unit: string;
  direction: string;
  basis: "change" | "value";
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

export type PacketLevel = {
  metric_id: string;
  label: string;
  unit: string;
  direction: string;
  value: number;
  period_start: string;
  period_end: string;
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
  levels: PacketLevel[];
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
    const response = await fetch(`${API_URL}${path}`);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * A model-written note about a region. Every field that lets a reader discount it is
 * required, because the failure this type guards against is prose being mistaken for a
 * measurement: `kind` is always the literal "interpretation", the model is named, and
 * `stale` says whether the numbers moved since the text was written.
 */
export type Explanation = {
  kind: "interpretation";
  region_id: number;
  window: string;
  body: string;
  model_id: string;
  model_label: string;
  runtime: string;
  generated_at: string;
  stale: boolean;
  disclaimer: string;
};

export const api = {
  regions: (query: string) =>
    tryGet<{ total: number; items: Region[] }>(`/regions?${query}`),
  region: (id: number) => tryGet<Region & { ancestors: Region[] }>(`/regions/${id}`),
  summary: (id: number, window: string) =>
    tryGet<Summary>(`/regions/${id}/summary?window=${window}`),
  rankings: (
    metricId: string,
    level: string,
    window: string,
    limit = 25,
    basis: "change" | "value" = "change",
  ) =>
    tryGet<Ranking>(
      `/rankings?metric_id=${metricId}&level=${level}&window=${window}` +
        `&limit=${limit}&basis=${basis}`,
    ),
  observations: (id: number, metricId: string) =>
    tryGet<{ observations: Observation[] }>(
      `/regions/${id}/metrics?metric_id=${metricId}`,
    ),
  packet: (id: number, window: string) =>
    tryGet<Packet>(`/regions/${id}/packet?window=${window}`),
  geo: (level: string) => tryGet<FeatureCollection>(`/geo/${level}?state=NJ`),
  explanation: (id: number, window: string) =>
    tryGet<Explanation>(`/regions/${id}/explanation?window=${window}`),
};

/**
 * The API's public origin, for links the *browser* follows — the Markdown export is
 * a direct download from the API, not a page this app renders. Everything else in
 * this module is fetched during server render, which is why `API_URL` otherwise stays
 * off the client.
 */
export const publicApiUrl = API_URL;

export { formatValue, formatChange } from "./format";

/**
 * Every region that carries at least one observation, for `generateStaticParams`.
 *
 * Asks the API rather than reading `hip publish`'s manifest off disk: the dashboard and
 * the Python side share no code and communicate only over HTTP (ARCHITECTURE #5), and
 * reading its output files would be a second kind of coupling for the sake of one list.
 * The `has_data` filter exists precisely so this question has an HTTP answer — without
 * it the only options were to build 2,181 blank tract pages or to read the manifest.
 *
 * Pages explicitly, because `limit` is capped at 1000 by the endpoint and New Jersey
 * alone returns 1,135. A silent single-page fetch would have dropped 135 regions and
 * produced a site with holes that nothing would have flagged.
 */
export async function regionsWithData(): Promise<Region[]> {
  const all: Region[] = [];
  const limit = 1000;
  for (let offset = 0; ; offset += limit) {
    const page = await tryGet<{ total: number; items: Region[] }>(
      `/regions?has_data=true&limit=${limit}&offset=${offset}`,
    );
    if (!page) {
      // A build that cannot reach the API should fail loudly rather than emit a site
      // with three pages in it.
      throw new Error(
        `Cannot reach the API at ${API_URL}. A static export needs it running: ` +
          `start it with \`make api\` before \`npm run build\`.`,
      );
    }
    all.push(...page.items);
    if (all.length >= page.total || page.items.length === 0) return all;
  }
}

/**
 * Origin the published JSON artifacts are served from, for links the browser follows.
 *
 * Separate from `publicApiUrl` because the two halves are deployed to different places:
 * HTML to a static host with a file-count limit, artifacts to object storage without
 * one. In development both default to the same local API.
 */
export const artifactUrl =
  process.env.NEXT_PUBLIC_ARTIFACT_URL ?? API_URL;

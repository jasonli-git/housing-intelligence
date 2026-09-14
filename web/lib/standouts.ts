/**
 * Where a region stands out (Milestone 23): the measures on which it sits at one end of its
 * peers — what leads and what lags by change over five years, and what is highest or
 * lowest by current value.
 *
 * The change stand-outs are the packet's own highlights, chosen by `hip pack` (within three
 * ranks of either end, in a cohort of at least five), so the page and the packet a model
 * reads agree on what stands out. The packet does not highlight current values, so the same
 * rule is applied to them here — the highest tax bill, the oldest homes — leaving out the
 * counts that follow a place's size: the largest county having the most people is not news.
 */

import type { Packet, PacketLevel, PacketMetric } from "@/lib/api";
import { formatChange, formatMetric } from "@/lib/format";
import { periodLabel } from "@/lib/periods";
import { ordinal } from "@/lib/ranks";

/** `HIGHLIGHT_DEPTH` and `MIN_COHORT` in `hip/packets/assemble.py`. */
const DEPTH = 3;
const MIN_COHORT = 5;

/** Counts that grow with a place's size, whose extremes only name the biggest and smallest places. */
const SIZE_COUNTS: ReadonlySet<string> = new Set([
  "acs_population",
  "modiv_residential_parcels",
  "permits_total_units",
  "net_migration_returns",
]);

export type StandOutGroup = "leads" | "lags" | "value";

export type StandOut = {
  metric_id: string;
  label: string;
  group: StandOutGroup;
  /** Its rank among its peers: "1st of 21". */
  rank: string;
  /** What it stands out on: a change, "+319.3%", or a value, "$12,238". */
  figure: string;
  /** The readings behind a change, "538 in 2019, 2,256 in 2024", or where a value sits, "the highest of 21". */
  detail: string;
};

function figureOf(value: number, unit: string, metricId: string): string {
  // A year is a label, not a quantity: 1948, never 1,948.
  if (unit === "year") return String(Math.round(value));
  return formatMetric(value, unit, metricId);
}

function changeDetail(metric: PacketMetric | undefined): string {
  if (!metric) return "";
  const at = (value: number, date: string) =>
    `${figureOf(value, metric.unit, metric.metric_id)} in ${periodLabel(date, metric.metric_id)}`;
  return `${at(metric.start_value, metric.window_start)}, ${at(metric.end_value, metric.window_end)}`;
}

/** "the highest of 21", "the 2nd lowest of 21", or null where the value is not near an end. */
function valueDetail(level: PacketLevel): string | null {
  if (level.rank === null || level.of === null || level.of < MIN_COHORT) return null;
  // Rank 1 is the highest value, or the lowest where lower is better (`lib/ranks.ts`).
  const fromHigh = level.direction === "lower_is_better" ? level.of - level.rank + 1 : level.rank;
  const fromLow = level.of - fromHigh + 1;
  if (fromHigh <= DEPTH) {
    return fromHigh === 1 ? `the highest of ${level.of}` : `the ${ordinal(fromHigh)} highest of ${level.of}`;
  }
  if (fromLow <= DEPTH) {
    return fromLow === 1 ? `the lowest of ${level.of}` : `the ${ordinal(fromLow)} lowest of ${level.of}`;
  }
  return null;
}

export function standOuts(packet: Pick<Packet, "highlights" | "metrics" | "levels">): StandOut[] {
  const metrics = new Map(packet.metrics.map((m) => [m.metric_id, m]));
  const changes = packet.highlights.map(
    (h): StandOut => ({
      metric_id: h.metric_id,
      label: h.label,
      group: h.position === "leading" ? "leads" : "lags",
      rank: `${ordinal(h.rank)} of ${h.of}`,
      figure: formatChange(h.pct_change),
      detail: changeDetail(metrics.get(h.metric_id)),
    }),
  );
  const values = packet.levels.flatMap((level): StandOut[] => {
    if (SIZE_COUNTS.has(level.metric_id)) return [];
    const detail = valueDetail(level);
    if (detail === null) return [];
    return [
      {
        metric_id: level.metric_id,
        label: level.label,
        group: "value",
        rank: `${ordinal(level.rank!)} of ${level.of}`,
        figure: figureOf(level.value, level.unit, level.metric_id),
        detail,
      },
    ];
  });
  return [...changes, ...values];
}

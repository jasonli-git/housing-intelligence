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
import {
  changeMarginLabel,
  marginLabel,
  type Uncertainties,
  type Uncertainty,
  withMargin,
} from "@/lib/uncertainty";

/** `HIGHLIGHT_DEPTH` and `MIN_COHORT` in `hip/packets/assemble.py`. */
const DEPTH = 3;
const MIN_COHORT = 5;

/** Counts that grow with a place's size, whose extremes only name the biggest and smallest places. */
const SIZE_COUNTS: ReadonlySet<string> = new Set([
  "acs_population",
  "modiv_residential_parcels",
  "permits_total_units",
  "net_migration_returns",
  "irs_inflow_returns",
  "irs_outflow_returns",
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
  /** A survey figure's margin beneath it, "± 4.0%" (Milestone 28); null otherwise. */
  margin: string | null;
  /** The readings behind a change, "538 in 2019, 2,256 in 2024", or where a value sits, "the highest of 21". */
  detail: string;
};

function figureOf(value: number, unit: string, metricId: string): string {
  // A year is a label, not a quantity: 1948, never 1,948.
  if (unit === "year") return String(Math.round(value));
  return formatMetric(value, unit, metricId);
}

function changeDetail(metric: PacketMetric | undefined, u?: Uncertainty): string {
  if (!metric) return "";
  // Each reading with its own margin where it is a survey's (Milestone 28).
  const at = (value: number, margin: number | null | undefined, date: string) =>
    `${withMargin(
      figureOf(value, metric.unit, metric.metric_id),
      marginLabel(value, margin ?? null, metric.unit, metric.metric_id),
    )} in ${periodLabel(date, metric.metric_id)}`;
  return (
    `${at(metric.start_value, u?.start, metric.window_start)}, ` +
    `${at(metric.end_value, u?.end, metric.window_end)}`
  );
}

/** A rank range that is more than one place (Milestone 28), or null. */
function spread(u: Uncertainty | undefined): { best: number; worst: number } | null {
  return u && u.best !== null && u.worst !== null && u.best !== u.worst
    ? { best: u.best, worst: u.worst }
    : null;
}

/** "the highest of 21", "the 2nd lowest of 21", or null where the value is not near an end. */
function valueDetail(level: PacketLevel, u?: Uncertainty): string | null {
  if (level.rank === null || level.of === null || level.of < MIN_COHORT) return null;
  const of = level.of;
  // Rank 1 is the highest value, or the lowest where lower is better (`lib/ranks.ts`).
  const high = (rank: number) => (level.direction === "lower_is_better" ? of - rank + 1 : rank);
  const range = spread(u);
  if (range) {
    // A survey figure stands out only where its whole range sits at one end: a margin
    // that could put it tenth is not "the highest" (Milestone 28).
    const ends = [high(range.best), high(range.worst)];
    if (Math.max(...ends) <= DEPTH) return `among the ${Math.max(...ends)} highest of ${of}`;
    if (Math.min(...ends) > of - DEPTH) return `among the ${of - Math.min(...ends) + 1} lowest of ${of}`;
    return null;
  }
  const fromHigh = high(level.rank);
  const fromLow = level.of - fromHigh + 1;
  if (fromHigh <= DEPTH) {
    return fromHigh === 1 ? `the highest of ${level.of}` : `the ${ordinal(fromHigh)} highest of ${level.of}`;
  }
  if (fromLow <= DEPTH) {
    return fromLow === 1 ? `the lowest of ${level.of}` : `the ${ordinal(fromLow)} lowest of ${level.of}`;
  }
  return null;
}

export function standOuts(
  packet: Pick<Packet, "highlights" | "metrics" | "levels">,
  uncertainties?: Uncertainties,
): StandOut[] {
  const metrics = new Map(packet.metrics.map((m) => [m.metric_id, m]));
  const rankText = (rank: number, of: number, u?: Uncertainty) => {
    const range = spread(u);
    return range
      ? `between ${ordinal(range.best)} and ${ordinal(range.worst)} of ${of}`
      : `${ordinal(rank)} of ${of}`;
  };
  const changes = packet.highlights.flatMap((h): StandOut[] => {
    // The packet picks a leader or a laggard by rank alone; a survey figure's margin can
    // leave it far from either end, and then it does not stand out (Milestone 28).
    const u = uncertainties?.change.get(h.metric_id);
    const range = spread(u);
    if (range && (h.position === "leading" ? range.worst > DEPTH : range.best <= h.of - DEPTH)) {
      return [];
    }
    return [
      {
        metric_id: h.metric_id,
        label: h.label,
        group: h.position === "leading" ? "leads" : "lags",
        rank: rankText(h.rank, h.of, u),
        figure: formatChange(h.pct_change),
        margin: changeMarginLabel(u?.margin ?? null, h.metric_id),
        detail: changeDetail(metrics.get(h.metric_id), u),
      },
    ];
  });
  const values = packet.levels.flatMap((level): StandOut[] => {
    if (SIZE_COUNTS.has(level.metric_id)) return [];
    const u = uncertainties?.value.get(level.metric_id);
    const detail = valueDetail(level, u);
    if (detail === null) return [];
    return [
      {
        metric_id: level.metric_id,
        label: level.label,
        group: "value",
        rank: rankText(level.rank!, level.of!, u),
        figure: figureOf(level.value, level.unit, level.metric_id),
        margin: marginLabel(level.value, u?.margin ?? null, level.unit, level.metric_id),
        detail,
      },
    ];
  });
  return [...changes, ...values];
}

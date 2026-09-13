/**
 * "Since the year I moved here" (Milestone 17): a series' reading in a year the reader
 * picks, against its latest, from the observations a region page already fetches.
 *
 * Like for like: a monthly series is read at the same month in the chosen year as its
 * latest reading, so July 2016 is set against July 2026 and a season is never mistaken
 * for a trend. An annual series — the ACS — is read by the year its estimate ends. A
 * year a series does not reach is said, not filled: the ACS series loaded begins in 2019,
 * and a figure borrowed from the nearest year would claim a reading that does not exist.
 */

import { formatMetric } from "@/lib/format";
import { periodLabel } from "@/lib/periods";

export type Point = { period_start: string; period_end: string; value: number };

export type Since = {
  from: Point;
  to: Point;
  pct: number;
};

function month(date: string): string {
  return date.slice(5, 7);
}

/**
 * The reading in `year` to set against the latest, or null where the series has none.
 * Monthly series are matched on the latest reading's month, falling back to the nearest
 * month in that year; annual series on the year their period ends.
 */
export function since(points: Point[], year: number): Since | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.period_end.localeCompare(b.period_end));
  const to = sorted.at(-1)!;
  const inYear = sorted.filter((p) => Number(p.period_end.slice(0, 4)) === year);
  if (inYear.length === 0 || year >= Number(to.period_end.slice(0, 4))) return null;

  const target = Number(month(to.period_end));
  const from = inYear.reduce((best, p) =>
    Math.abs(Number(month(p.period_end)) - target) < Math.abs(Number(month(best.period_end)) - target)
      ? p
      : best,
  );
  return { from, to, pct: (to.value / from.value - 1) * 100 };
}

/** The years a reader can pick: every year before the latest that some series reaches. */
export function selectableYears(series: Point[][]): number[] {
  const years = new Set<number>();
  let latest = 0;
  for (const points of series) {
    for (const p of points) {
      const year = Number(p.period_end.slice(0, 4));
      years.add(year);
      latest = Math.max(latest, year);
    }
  }
  return [...years].filter((y) => y < latest).sort((a, b) => b - a);
}

/** The first year a series reaches, for saying why a chosen year has no reading. */
export function firstYear(points: Point[]): number | null {
  if (points.length === 0) return null;
  return Math.min(...points.map((p) => Number(p.period_end.slice(0, 4))));
}

export type Series = { metricId: string; label: string; unit: string; points: Point[] };
export type SinceLine = { metricId: string; label: string; text: string };

/**
 * One series against a chosen year, as the page says it: "$332,021 in Jul 2016,
 * $450,985 in Jul 2026: up 35.8%", or why there is no reading for that year.
 */
export function sinceLine(series: Series, year: number): SinceLine {
  const { metricId, label, unit, points } = series;
  const result = since(points, year);
  if (!result) {
    const first = firstYear(points);
    const why = first !== null && year < first ? `; the series begins in ${first}` : "";
    return { metricId, label, text: `no reading for ${year}${why}` };
  }
  const fmt = (p: Point) => formatMetric(p.value, unit, metricId);
  const when = (p: Point) => periodLabel(p.period_end, metricId);
  const change = result.pct === 0 ? "unchanged" : `${result.pct > 0 ? "up" : "down"} ${Math.abs(result.pct).toFixed(1)}%`;
  return {
    metricId,
    label,
    text: `${fmt(result.from)} in ${when(result.from)}, ${fmt(result.to)} in ${when(result.to)}: ${change}`,
  };
}

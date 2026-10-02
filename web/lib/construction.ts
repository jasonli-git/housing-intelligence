/**
 * Is a place adding homes, or only approving them (Milestone 39, ARCHITECTURE #300)?
 * Permits from the Census Bureau beside DCA's certificates of occupancy and demolitions,
 * year by year, and a five-year comparison of the two ends of the pipeline.
 *
 * Kept apart from the component so each rule is tested on its own: a year a town did not
 * report is missing, never zero; a permit year counts only when all twelve months are in;
 * a year read from DCA's December year-to-date report is preliminary.
 */

import type { Observation } from "@/lib/api";

export type YearFigure = { value: number; preliminary: boolean };

/** One series by calendar year: monthly readings summed, a year with fewer than twelve
 * left out, so a year still under way is never compared as if whole. */
export function byYear(observations: Observation[]): Map<number, YearFigure> {
  const years = new Map<number, { value: number; months: number; annual: boolean; preliminary: boolean }>();
  for (const o of observations) {
    const year = Number(o.period_end.slice(0, 4));
    const annual = o.period_start.slice(0, 4) === o.period_end.slice(0, 4) &&
      o.period_start.slice(5, 7) === "01" && o.period_end.slice(5, 7) === "12";
    const held = years.get(year) ?? { value: 0, months: 0, annual: false, preliminary: false };
    held.value += o.value;
    held.months += annual ? 12 : 1;
    held.annual ||= annual;
    held.preliminary ||= o.vintage.endsWith("-ytd");
    years.set(year, held);
  }
  const out = new Map<number, YearFigure>();
  for (const [year, held] of years) {
    if (held.months >= 12) out.set(year, { value: held.value, preliminary: held.preliminary });
  }
  return out;
}

export type ConstructionYear = {
  year: number;
  permitted: number | null;
  completed: number | null;
  demolished: number | null;
  net: number | null;
  preliminary: boolean;
};

/** The newest `count` years any of the series reaches, newest first. */
export function constructionYears(
  series: { permitted: Observation[]; completed: Observation[]; demolished: Observation[]; net: Observation[] },
  count = 6,
): ConstructionYear[] {
  const permitted = byYear(series.permitted);
  const completed = byYear(series.completed);
  const demolished = byYear(series.demolished);
  const net = byYear(series.net);
  const years = [...new Set([...completed.keys(), ...demolished.keys()])].sort((a, b) => b - a);
  return years.slice(0, count).map((year) => ({
    year,
    permitted: permitted.get(year)?.value ?? null,
    completed: completed.get(year)?.value ?? null,
    demolished: demolished.get(year)?.value ?? null,
    net: net.get(year)?.value ?? null,
    preliminary: Boolean(completed.get(year)?.preliminary || demolished.get(year)?.preliminary),
  }));
}

export type FiveYears = {
  first: number;
  last: number;
  permitted: number;
  completed: number;
  demolished: number | null;
  net: number | null;
  /** Years in the window the town reported completions for, of five. */
  reported: number;
};

/**
 * The newest five final years (no preliminary one) with permits for the whole year,
 * and the sums over them: permits over every year, completions over the years the town
 * reported. Null when there is no such window or no completions were reported in it.
 */
export function fiveYears(rows: ConstructionYear[], permittedYears: Map<number, YearFigure>): FiveYears | null {
  const final = rows.filter((r) => !r.preliminary).map((r) => r.year);
  if (final.length === 0) return null;
  const last = Math.max(...final);
  const window = [0, 1, 2, 3, 4].map((i) => last - i);
  if (!window.every((y) => permittedYears.has(y))) return null;
  const inWindow = rows.filter((r) => window.includes(r.year));
  const reported = inWindow.filter((r) => r.completed !== null);
  if (reported.length === 0) return null;
  const sum = (values: (number | null)[]) =>
    values.some((v) => v !== null) ? values.reduce<number>((a, v) => a + (v ?? 0), 0) : null;
  return {
    first: last - 4,
    last,
    permitted: window.reduce((a, y) => a + (permittedYears.get(y)?.value ?? 0), 0),
    completed: reported.reduce((a, r) => a + (r.completed ?? 0), 0),
    demolished: sum(inWindow.map((r) => r.demolished)),
    net: sum(inWindow.map((r) => r.net)),
    reported: reported.length,
  };
}

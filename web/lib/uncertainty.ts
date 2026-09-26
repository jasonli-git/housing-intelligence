/**
 * How sure a figure is, in words (Milestone 28).
 *
 * The Census publishes a 90% margin of error with every survey estimate, and a rank
 * built from survey figures inherits it: "9th of 21" when the margins cannot tell ninth
 * from fifth. The API works out each figure's margin and the ranks it could plausibly
 * hold (`hip/analytics/compute.py`, `_rank_ranges`); this module says them. A figure
 * from a source with no margins — Zillow's index, MOD-IV's records — reads exactly as
 * it did before.
 *
 * An uncertain rank leads with a word for where its range sits and gives the range
 * beneath: "Near the middle of 21 NJ counties", "between 10th and 12th" — decided with
 * the owner on 2026-09-26, over the range alone or the word alone.
 */

import type { Summary } from "@/lib/api";
import { formatMetric, MULTIPLE_METRICS, SHARE_METRICS } from "@/lib/format";
import { ordinal, rankPosition } from "@/lib/ranks";

/** A figure's 90% margin of error and the ranks it could hold. Nulls where none apply. */
export type Uncertainty = {
  margin: number | null;
  best: number | null;
  worst: number | null;
};

export type Uncertainties = {
  /** Each metric's latest value, by metric id. */
  value: Map<string, Uncertainty>;
  /** Each metric's change over the summary's window, by metric id. */
  change: Map<string, Uncertainty>;
};

/** The summary's margins and rank ranges, looked up by metric. Empty without a summary. */
export function uncertaintiesFrom(summary: Summary | null): Uncertainties {
  const value = new Map<string, Uncertainty>();
  const change = new Map<string, Uncertainty>();
  for (const level of summary?.levels ?? []) {
    value.set(level.metric_id, {
      margin: level.margin_of_error ?? null,
      best: level.rank_best ?? null,
      worst: level.rank_worst ?? null,
    });
  }
  for (const headline of summary?.headlines ?? []) {
    change.set(headline.metric_id, {
      margin: headline.pct_change_margin ?? null,
      best: headline.rank_best ?? null,
      worst: headline.rank_worst ?? null,
    });
  }
  return { value, change };
}

export type Peers = { count: number; noun: string; scope: string };

/**
 * The cohort a rank is among, named where it is read: "21 NJ counties", or "551 NJ
 * municipalities with data" where fewer regions carry the figure than the level has.
 * Replaces the page's standalone "every figure ranked against …" line (Milestone 28).
 */
export function cohortLabel(of: number, peers: Peers): string {
  const scope = peers.scope === "New Jersey" ? "NJ" : peers.scope;
  return of === peers.count
    ? `${of} ${scope} ${peers.noun}`
    : `${of} ${scope} ${peers.noun} with data`;
}

export type RankReading = {
  /** "3rd of 21 NJ counties", or a word for where an uncertain rank's range sits. */
  lead: string;
  /** "between 10th and 12th", beneath the word; null for a rank that is one place. */
  range: string | null;
};

/**
 * A rank as a reader should take it. One place when the range is one place, or when
 * the metric has no margins; otherwise the word for where the range sits, by thirds of
 * the cohort, and the range. A range spanning the whole cohort — a margin too wide, or
 * one the Census could not measure — cannot be placed at all, and says so.
 */
export function rankReading(
  rank: number,
  of: number,
  uncertainty: Uncertainty | undefined,
  cohort: string,
): RankReading {
  const best = uncertainty?.best ?? null;
  const worst = uncertainty?.worst ?? null;
  if (best === null || worst === null || best === worst) {
    return { lead: `${ordinal(rank)} of ${cohort}`, range: null };
  }
  if (best === 1 && worst === of) {
    return { lead: `Too uncertain to place among ${cohort}`, range: null };
  }
  const from = rankPosition(best, of);
  const to = rankPosition(worst, of);
  const word =
    to <= 1 / 3
      ? "Near the top"
      : from >= 2 / 3
        ? "Near the bottom"
        : from >= 1 / 3 && to <= 2 / 3
          ? "Near the middle"
          : from < 1 / 3 && to > 2 / 3
            ? "Can’t be told apart from most"
            : from < 1 / 3
              ? "Toward the top"
              : "Toward the bottom";
  return { lead: `${word} of ${cohort}`, range: `between ${ordinal(best)} and ${ordinal(worst)}` };
}

/**
 * A value's margin as it reads beside the value: "± $2,565", "± 2.3 points" for a share,
 * "± 0.12×" for a multiple. A share whose margin would carry it past 0% or 100% reads as
 * its range instead — "0.0% to 40.1%" — since "12.0% ± 28.0 points" implies a negative
 * share; for a town with a handful of renters that is the honest reading.
 */
export function marginLabel(
  value: number,
  margin: number | null,
  unit: string,
  metricId: string,
): string | null {
  if (margin === null) return null;
  if (unit === "ratio" && SHARE_METRICS.has(metricId)) {
    const low = value - margin;
    const high = value + margin;
    if (low < 0 || high > 1) {
      return `${formatMetric(Math.max(0, low), unit, metricId)} to ${formatMetric(Math.min(1, high), unit, metricId)}`;
    }
    return `± ${(margin * 100).toFixed(1)} points`;
  }
  if (unit === "ratio" && MULTIPLE_METRICS.has(metricId)) {
    return `± ${margin.toFixed(2)}×`;
  }
  return `± ${formatMetric(margin, unit, metricId)}`;
}

/**
 * A change's margin in the terms the change is stated in: "+24.2%" reads "± 4.0%", so the
 * change could have been anywhere from +20.2% to +28.2%. Not "points", which on this
 * site already means a share's percentage points ("50.1% ± 2.3 points").
 */
export function changeMarginLabel(margin: number | null): string | null {
  return margin === null ? null : `± ${margin.toFixed(1)}%`;
}

/** Whether any figure on a page carries a margin, which is when the note below applies. */
export function anyMargin(uncertainties: Uncertainties): boolean {
  return [...uncertainties.value.values(), ...uncertainties.change.values()].some(
    (u) => u.margin !== null,
  );
}

/** What "±" and a rank range mean, said once under the tables that show them. */
export const MARGIN_NOTE =
  "Figures marked ± come from the Census Bureau’s survey and carry its 90% margin of error: " +
  "the true figure is very likely within that range of the estimate. Where the margins " +
  "cannot tell a place from its neighbours, its rank reads as a range. HUD’s CHAS " +
  "figures come from the same survey, but HUD publishes no margins with them, so their " +
  "ranks read as single places.";

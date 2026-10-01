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
  /** A change's two ends, `start_value` and `end_value`: their own margins (0018). */
  start?: number | null;
  end?: number | null;
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
      start: headline.start_margin ?? null,
      end: headline.end_margin ?? null,
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
 * The metrics estimated from a sample survey (SPEC principle 12): the Census's ACS, the
 * three ratios divided by its income, and HUD's CHAS tables, which HUD builds from ACS
 * microdata. `tests/test_survey_metrics.py` keeps it in step with `config/metrics.yml`.
 * A figure of one of these without a margin says so rather than reading as exact.
 */
export const SURVEY_METRICS = new Set([
  "acs_median_rent_studio",
  "acs_median_rent_1br",
  "acs_median_rent_2br",
  "acs_median_rent_3br",
  "acs_median_rent_4br",
  "acs_rent_lower_quartile",
  "acs_rent_upper_quartile",
  "acs_owner_costs_mortgage",
  "acs_owner_costs_no_mortgage",
  "acs_renter_severe_burden",
  "acs_owner_severe_burden",
  "acs_share_detached",
  "acs_share_attached",
  "acs_share_2_4_units",
  "acs_share_5_19_units",
  "acs_share_20plus_units",
  "acs_share_mobile_homes",
  "acs_median_year_built",
  "acs_share_built_2000_later",
  "acs_share_built_1980_1999",
  "acs_share_built_1940_1979",
  "acs_share_built_pre_1940",
  "acs_share_0_1_bedrooms",
  "acs_share_2_bedrooms",
  "acs_share_3_bedrooms",
  "acs_share_4plus_bedrooms",
  "acs_overcrowded_share",
  "acs_lacking_plumbing_share",
  "acs_lacking_kitchen_share",
  "acs_avg_household_size",
  "acs_no_vehicle_share",
  "acs_rental_vacancy_rate",
  "acs_homeowner_vacancy_rate",
  "acs_vacant_seasonal_share",
  "acs_vacant_other_share",
  "acs_heat_gas_share",
  "acs_heat_electric_share",
  "acs_heat_oil_share",
  "acs_heat_propane_share",
  "acs_heat_other_share",
  "acs_commute_transit_share",
  "acs_work_from_home_share",
  "acs_commute_drove_alone_share",
  "acs_commute_walked_share",
  "acs_mean_commute_minutes",
  "acs_commute_60plus_share",
  "acs_living_alone_share",
  "acs_married_couple_share",
  "acs_with_children_share",
  "acs_disability_share",
  "acs_homeownership_rate",
  "acs_median_electricity",
  "acs_median_gas",
  "acs_median_gross_rent",
  "acs_median_hh_income",
  "acs_median_home_insurance",
  "acs_median_home_value",
  "acs_median_other_fuel",
  "acs_median_water_sewer",
  "acs_population",
  "acs_renter_cost_burden",
  "acs_renters_paying_utilities",
  "acs_vacancy_rate",
  "chas_owner_cost_burden",
  "chas_renter_cost_burden",
  "chas_renter_severe_burden",
  "fmr_to_income",
  "price_to_income",
  "rent_to_income",
]);

/**
 * What a survey figure without a margin says in its place: a Census special code, or
 * HUD's CHAS figures, whose margins the HUD source this site reads does not carry.
 */
export const NO_MARGIN = "no margin available";

/**
 * What a margin of zero says: the Census fixes some survey figures — a county's or the
 * state's population — to its population estimates rather than estimating them from the
 * sample, and publishes no sampling error for them (a special code `acs_margin` reads as
 * 0). "± 0" would read as a margin that happens to be tiny, or as an exact count.
 */
export const NO_SAMPLING_ERROR = "no sampling error";

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
  if (margin === null) return SURVEY_METRICS.has(metricId) ? NO_MARGIN : null;
  if (margin === 0) return NO_SAMPLING_ERROR;
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
export function changeMarginLabel(margin: number | null, metricId?: string): string | null {
  if (margin === null) return metricId && SURVEY_METRICS.has(metricId) ? NO_MARGIN : null;
  // Both ends fixed to the population estimates: the change has no sampling error either.
  if (margin === 0) return NO_SAMPLING_ERROR;
  return `± ${margin.toFixed(1)}%`;
}

/**
 * A figure and its margin in one run of text, for a sentence or a card too small for a
 * second line: "$100,645 ± $2,565", "50.1% ± 2.3 points", or a share whose margin would
 * pass 0% or 100% with its range, "12.0% (0.0% to 40.0%)". The figure alone without one.
 */
export function withMargin(shown: string, label: string | null): string {
  if (label === null) return shown;
  return label.startsWith("±") ? `${shown} ${label}` : `${shown} (${label})`;
}

/**
 * The 90% margin of a percentage change between two survey estimates, in the change's
 * own percent: the Census's formula for a ratio of two estimates, end over start, taken
 * as independent — as `fact_metric_change.pct_change_margin` is computed (ARCHITECTURE
 * #238). For a change between two years a reader picks, which the warehouse does not
 * store. Null unless both ends have a margin.
 */
export function changeMargin(
  start: number,
  end: number,
  startMargin: number | null | undefined,
  endMargin: number | null | undefined,
): number | null {
  if (startMargin == null || endMargin == null || start === 0) return null;
  return (100 * Math.sqrt(endMargin ** 2 + (end / start) ** 2 * startMargin ** 2)) / Math.abs(start);
}

/**
 * The ranks each region could hold among `values`, by the Census's test at 90% — the
 * same rule `_rank_ranges` applies in the warehouse (ARCHITECTURE #239): a region moves
 * ahead of another only where they differ by more than the root of their summed squared
 * margins. For a list ranked in the browser, as the New Jersey page's municipalities
 * are from the map's own figures. Empty where no region has a margin, so a measure
 * without them keeps its single places; a region whose own margin is unknown differs
 * significantly from no one and gets the whole list.
 */
export function rankRanges(
  values: Record<string, number>,
  margins: Record<string, number> | undefined,
  direction: string,
): Map<string, { best: number; worst: number }> {
  const ranges = new Map<string, { best: number; worst: number }>();
  if (!margins || Object.keys(margins).length === 0) return ranges;
  // Rank 1 is the better end: the smallest where lower is better, else the largest.
  const key = (v: number) => (direction === "lower_is_better" ? v : -v);
  const ids = Object.keys(values);
  for (const a of ids) {
    let better = 0;
    let worse = 0;
    const ma = margins[a];
    if (ma !== undefined) {
      for (const b of ids) {
        const mb = margins[b];
        if (b === a || mb === undefined) continue;
        const threshold = Math.sqrt(ma ** 2 + mb ** 2);
        const gap = key(values[a]) - key(values[b]);
        if (gap > threshold) better += 1;
        else if (-gap > threshold) worse += 1;
      }
    }
    ranges.set(a, { best: 1 + better, worst: ids.length - worse });
  }
  return ranges;
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
  "cannot tell a place from its neighbours, its rank reads as a range. “No sampling " +
  "error” marks a figure the Census fixes to its population estimates rather than " +
  "estimating from the survey, such as a county’s population. HUD’s CHAS " +
  "figures come from the same survey, but the HUD source this site reads carries no " +
  "margins, so they show none yet and their ranks read as single places.";

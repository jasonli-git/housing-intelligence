/**
 * Pure value formatting, importable from server *and* client components.
 *
 * Separate from `lib/api.ts` on purpose: that module holds the fetch layer and the API
 * base URL, which belong on the server only. Functions cannot be passed across the RSC
 * boundary as props, so a client chart imports its formatter rather than receiving one.
 */

export function formatValue(value: number, unit: string): string {
  if (unit === "usd" || unit === "usd_month") {
    return `$${Math.round(value).toLocaleString()}`;
  }
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "ratio") return value.toFixed(2);
  if (unit === "count") return Math.round(value).toLocaleString();
  // A year is a label, not a quantity: "1,955" is wrong.
  if (unit === "year") return String(Math.round(value));
  if (unit === "acres") return `${value.toFixed(2)} ac`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function formatChange(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

/**
 * The `ratio` metrics that are shares, and the ones that are multiples.
 *
 * The unit says "ratio" for both — homeownership is 0.62 of occupied homes, a home costs
 * 4.13 times income — and a reader needs "61.9%" for one and "4.13×" for the other. The
 * packet keeps the unit it has, because changing it would change every packet's content
 * hash and mark every explanation stale; the dashboard classifies instead. A `ratio`
 * metric in neither set throws, and since every page renders at build time, an
 * unclassified new metric fails `make publish` rather than shipping as "0.62" or "413%".
 */
export const SHARE_METRICS: ReadonlySet<string> = new Set([
  "acs_homeownership_rate",
  "acs_renter_cost_burden",
  "acs_vacancy_rate",
  "chas_owner_cost_burden",
  "chas_renter_cost_burden",
  "chas_renter_severe_burden",
  "fmr_to_income",
  "rent_to_income",
  "modiv_multifamily_share",
  "modiv_vacant_land_share",
]);

export const MULTIPLE_METRICS: ReadonlySet<string> = new Set(["price_to_income", "price_to_ami"]);

/**
 * A metric's value as the dashboard shows it: a share as a percentage, a multiple with
 * ×, monthly money per month. Everything else is `formatValue`, which stays in step with
 * the Markdown report's formatter.
 */
export function formatMetric(value: number, unit: string, metricId: string): string {
  if (unit === "ratio") {
    if (SHARE_METRICS.has(metricId)) return `${(value * 100).toFixed(1)}%`;
    if (MULTIPLE_METRICS.has(metricId)) return `${value.toFixed(2)}×`;
    throw new Error(
      `${metricId} is a ratio classed as neither a share nor a multiple: add it to ` +
        `SHARE_METRICS or MULTIPLE_METRICS in web/lib/format.ts.`,
    );
  }
  if (unit === "usd_month") return `${formatValue(value, unit)}/mo`;
  return formatValue(value, unit);
}

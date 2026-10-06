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
  if (unit === "rate_per_100") return `$${value.toFixed(2)} per $100`;
  if (unit === "ratio") return value.toFixed(2);
  if (unit === "count") return Math.round(value).toLocaleString();
  // A year is a label, not a quantity: "1,955" is wrong.
  if (unit === "year") return String(Math.round(value));
  if (unit === "acres") return `${value.toFixed(2)} ac`;
  // Milestone 34: people per household, and minutes of commuting each way.
  if (unit === "people") return value.toFixed(2);
  if (unit === "minutes") return `${value.toFixed(1)} min`;
  // Milestone 39: net homes added per 1,000 homes standing.
  if (unit === "per_1000_homes") return `${value.toFixed(1)} per 1,000 homes`;
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
  "sr1a_median_sales_ratio",
  "acs_renter_severe_burden",
  "acs_owner_severe_burden",
  "acs_share_detached",
  "acs_share_attached",
  "acs_share_2_4_units",
  "acs_share_5_19_units",
  "acs_share_20plus_units",
  "acs_share_mobile_homes",
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
  "acs_commute_60plus_share",
  "acs_living_alone_share",
  "acs_married_couple_share",
  "acs_with_children_share",
  "acs_disability_share",
  "acs_homeownership_rate",
  "acs_renter_cost_burden",
  "acs_renters_paying_utilities",
  "acs_vacancy_rate",
  // Milestone 39: the share of an area's towns a construction total covers.
  "nj_certificates_reporting_share",
  "nj_demolitions_reporting_share",
  // Milestone 40: shares of homes in a flood area, and on public water.
  "fema_flood_homes_share",
  "fema_flood_homes_share_moderate",
  "fema_mapped_homes_share",
  "njdep_tidal_homes_share",
  "water_homes_share_public",
  "water_homes_share_violation",
  // Milestone 45: shares of residents' jobs by destination, and of homes near transit.
  "lodes_work_same_town_share",
  "lodes_work_home_county_share",
  "lodes_work_other_nj_share",
  "lodes_work_nyc_share",
  "lodes_work_pennsylvania_share",
  "lodes_work_other_state_share",
  "transit_rail_homes_share",
  "transit_bus_homes_share",
  "transit_any_homes_share",
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

/**
 * What kind of figure each metric is (SPEC principle 11, Milestone 31): shown beside it
 * in every table that lists metrics, and in its definition card. The same kinds as
 * `record_type` in `config/metrics.yml`, which `tests/test_licences.py` keeps this in
 * step with — a static map, like `SURVEY_METRICS`, because a definition card names only
 * its metric and the pages are built without asking the API for it.
 */

export type RecordType =
  | "survey"
  | "administrative"
  | "determination"
  | "benchmark"
  | "calculated"
  | "modelled";

export const KIND_LABELS: Record<RecordType, string> = {
  survey: "Survey estimate",
  administrative: "Administrative records",
  determination: "Official determination",
  benchmark: "Published benchmark",
  calculated: "Calculated here",
  modelled: "Modelled estimate",
};

/** What each kind means, for the tag's own tooltip. */
export const KIND_MEANINGS: Record<RecordType, string> = {
  survey: "Estimated from a sample survey, so it carries a margin of error.",
  administrative: "Counted from official records, such as permits, deeds or the tax roll.",
  determination: "A figure an agency sets and publishes as its own, used exactly as published.",
  benchmark: "An average its publisher reports as a benchmark, without a margin of error.",
  calculated: "Worked out by this site from other figures, by a stated formula.",
  modelled: "Estimated by its publisher with a statistical model rather than counted.",
};

export const KINDS: Record<string, RecordType> = {
  acs_homeownership_rate: "survey",
  acs_median_gross_rent: "survey",
  acs_median_hh_income: "survey",
  acs_median_home_value: "survey",
  acs_population: "survey",
  acs_renter_cost_burden: "survey",
  acs_vacancy_rate: "survey",
  chas_owner_cost_burden: "survey",
  chas_renter_cost_burden: "survey",
  chas_renter_severe_burden: "survey",
  fhfa_hpi: "modelled",
  fhfa_hpi_all_transactions: "modelled",
  fmr_to_income: "calculated",
  hud_area_median_income: "determination",
  hud_fmr_2br: "determination",
  hud_income_limit_80: "determination",
  modiv_median_assessed_value: "administrative",
  modiv_median_lot_acres: "administrative",
  modiv_median_tax_bill: "administrative",
  modiv_median_year_built: "administrative",
  modiv_multifamily_share: "administrative",
  modiv_residential_parcels: "administrative",
  modiv_vacant_land_share: "administrative",
  mortgage_rate_30y: "benchmark",
  mortgage_rate_30y_weekly: "benchmark",
  net_migration_returns: "administrative",
  nj_director_ratio: "determination",
  nj_effective_tax_rate: "determination",
  nj_general_tax_rate: "determination",
  pep_population: "modelled",
  permits_total_units: "administrative",
  price_to_ami: "calculated",
  price_to_income: "calculated",
  rent_to_income: "calculated",
  sr1a_median_sale_price: "administrative",
  unemployment_rate: "modelled",
  zhvi_sfr: "modelled",
  zori_all: "modelled",
};

export function kindOf(metricId: string): RecordType | null {
  return KINDS[metricId] ?? null;
}

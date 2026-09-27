/** Short, plain-language explanations for measures in the New Jersey map selector.
 * The fuller shared definitions remain in tables, profiles, and reports. */

import { definitionOf } from "@/lib/definitions";

export const MAP_DEFINITIONS: Record<string, string> = {
  zhvi_sfr: "Zillow’s estimate of a typical single-family home’s value, not a recent sale price.",
  acs_median_home_value: "The middle value homeowners reported in a five-year Census survey. It includes all kinds of owned homes.",
  zori_all: "Zillow’s estimate of typical asking rent for listed rentals, including apartments and houses.",
  acs_median_gross_rent: "The middle monthly rent current tenants reported, including utilities.",
  hud_fmr_2br: "HUD’s rent benchmark for a modest two-bedroom home, including utilities.",
  price_to_income: "Typical home value divided by a typical household’s yearly income. Higher means buying is harder on local incomes.",
  price_to_ami: "Typical home value divided by HUD’s yearly income benchmark for families in this area.",
  rent_to_income: "The share of a typical household’s income needed for a year of asking rent.",
  fmr_to_income: "The share of a typical household’s income needed for HUD’s two-bedroom rent benchmark.",
  acs_renter_cost_burden: "The share of renters spending over 30% of their income on rent and utilities.",
  acs_median_hh_income: "Middle household income in a five-year Census survey: half of households earn more, half less.",
  hud_area_median_income: "HUD’s estimate of middle family income in this area. Housing programs use it to set eligibility.",
  hud_income_limit_80: "The income cutoff for HUD to count a four-person family as low-income here.",
  unemployment_rate: "The share of people working or looking for work who have no job.",
  permits_total_units: "New homes approved for construction in a year, counting each apartment separately.",
  acs_vacancy_rate: "The share of homes with no resident, including seasonal homes. It does not mean all are for rent.",
  acs_homeownership_rate: "The share of occupied homes lived in by their owners rather than renters.",
  acs_population: "A Census survey estimate of how many people live here, based on five years of responses.",
  net_migration_returns: "Households moving in minus those moving out, based on tax-return addresses.",
  pep_population: "The Census Bureau’s yearly estimate of how many people live here.",
};

export function mapDefinitionOf(metricId: string): string | null {
  return MAP_DEFINITIONS[metricId] ?? definitionOf(metricId)?.what ?? null;
}

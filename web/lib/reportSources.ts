/** Compact report labels. Unknown sources keep their registry name, not a guessed acronym. */
const LABELS: Record<string, string> = {
  census_acs: "Census ACS", census_pep: "Census population", census_permits: "Census permits",
  census_saipe: "Census SAIPE", census_lodes: "Census LODES", census_tiger: "Census TIGER",
  zillow_zhvi: "Zillow ZHVI", zillow_zori: "Zillow ZORI", hip_derived: "Calculated here",
  fhfa_hpi: "FHFA HPI", fhfa_hpi_county: "FHFA county HPI", fred: "FRED", bls: "BLS",
  hud: "HUD income limits", hud_fmr: "HUD fair market rents", hud_chas: "HUD CHAS", hud_chas_bulk: "HUD CHAS",
  irs_migration: "IRS migration", nj_modiv: "NJ MOD-IV", nj_sr1a: "NJ sales", nj_tax_rates: "NJ tax rates",
  nj_construction: "NJ construction", nj_equalized: "NJ equalized values", nj_affordable: "NJ affordable housing",
  fema_nfhl: "FEMA flood map", fema_nfip_claims: "FEMA flood claims", njdep_cafe: "NJDEP climate flood map",
  njdep_kcsl: "NJDEP contaminated sites", njdep_water_areas: "NJDEP water areas", epa_sdwis: "EPA water records",
  fcc_bdc: "FCC broadband", ffiec_hmda: "HMDA mortgages", bts_ntm: "BTS transit",
  cdc_places: "CDC PLACES", nj_crime: "NJ crime reports", doe_lead: "DOE LEAD", eia861: "EIA-861",
};

export function reportSourceLabel(id: string | null, registryName?: string): string {
  if (!id) return "—";
  return LABELS[id] ?? registryName ?? id;
}

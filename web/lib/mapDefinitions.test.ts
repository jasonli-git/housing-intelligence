import { describe, expect, it } from "vitest";

import { MAP_DEFINITIONS, mapDefinitionOf } from "@/lib/mapDefinitions";

describe("New Jersey map definitions", () => {
  it("has a short explanation for every measure currently in the map selector", () => {
    const mapMeasureIds = [
      "zhvi_sfr", "acs_median_home_value", "zori_all", "acs_median_gross_rent",
      "hud_fmr_2br", "price_to_income", "price_to_ami", "rent_to_income",
      "fmr_to_income", "acs_renter_cost_burden", "acs_median_hh_income",
      "hud_area_median_income", "hud_income_limit_80", "unemployment_rate",
      "permits_total_units", "acs_vacancy_rate", "acs_homeownership_rate",
      "acs_population", "net_migration_returns", "pep_population",
    ];
    expect(Object.keys(MAP_DEFINITIONS).sort()).toEqual(mapMeasureIds.sort());
    for (const id of mapMeasureIds) {
      expect(mapDefinitionOf(id)?.length).toBeLessThan(140);
    }
  });

  it("falls back to the shared definition for a newly published map measure", () => {
    expect(mapDefinitionOf("modiv_median_tax_bill")).toContain("property tax");
  });
});

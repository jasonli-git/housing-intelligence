import { describe, expect, it } from "vitest";

import { GROUPS, groupRows, rampFor } from "@/lib/groups";

// The metric catalog as `GET /metrics` returned it on 2026-09-20. A metric added to
// `config/metrics.yml` belongs here and in a group; until it is, it renders under
// "Other measures" rather than disappearing.
const CATALOG = [
  "acs_homeownership_rate",
  "acs_median_gross_rent",
  "acs_median_hh_income",
  "acs_median_home_value",
  "acs_population",
  "acs_renter_cost_burden",
  "acs_vacancy_rate",
  "chas_owner_cost_burden",
  "chas_renter_cost_burden",
  "chas_renter_severe_burden",
  "fhfa_hpi",
  "fhfa_hpi_all_transactions",
  "fmr_to_income",
  "hud_area_median_income",
  "hud_fmr_2br",
  "hud_income_limit_80",
  "modiv_median_assessed_value",
  "modiv_median_lot_acres",
  "modiv_median_tax_bill",
  "modiv_median_year_built",
  "modiv_multifamily_share",
  "modiv_residential_parcels",
  "modiv_vacant_land_share",
  "mortgage_rate_30y",
  "net_migration_returns",
  "nj_director_ratio",
  "nj_effective_tax_rate",
  "nj_general_tax_rate",
  "permits_total_units",
  "price_to_ami",
  "price_to_income",
  "rent_to_income",
  "sr1a_median_sale_price",
  "unemployment_rate",
  "zhvi_sfr",
  "zori_all",
];

describe("GROUPS", () => {
  it("places every catalogued metric in exactly one group", () => {
    const listed = GROUPS.flatMap((g) => g.metrics);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual([...CATALOG].sort());
  });
});

describe("groupRows", () => {
  it("sections rows in page order and orders each section as listed", () => {
    const rows = [
      "acs_median_hh_income",
      "zori_all",
      "zhvi_sfr",
      "price_to_income",
    ].map((metric_id) => ({ metric_id }));

    const sections = groupRows(rows);

    expect(sections.map((s) => s.title)).toEqual([
      "Prices",
      "Affordability",
      "Incomes and jobs",
    ]);
    expect(sections[0].rows.map((r) => r.metric_id)).toEqual([
      "zhvi_sfr",
      "zori_all",
    ]);
  });

  it("keeps an unknown metric under Other measures rather than dropping it", () => {
    const sections = groupRows([
      { metric_id: "zhvi_sfr" },
      { metric_id: "something_new" },
    ]);

    expect(sections.at(-1)).toEqual({
      key: "other",
      title: "Other measures",
      rows: [{ metric_id: "something_new" }],
    });
  });

  it("leaves out a section with nothing in it", () => {
    expect(
      groupRows([{ metric_id: "unemployment_rate" }]).map((s) => s.key),
    ).toEqual(["incomes"]);
  });
});

describe("the ramp a measure's map is drawn in", () => {
  it("gives each group its own hue", () => {
    const hues = new Set(
      [
        "zhvi_sfr",
        "price_to_income",
        "acs_median_hh_income",
        "acs_vacancy_rate",
      ].map((id) => rampFor(id)[0]),
    );

    expect(hues.size).toBe(4);
  });

  it("keeps one hue within a group, so only lightness moves across a map", () => {
    const ramp = rampFor("price_to_income");

    expect(ramp).toHaveLength(5);
    expect(ramp.every((step) => step.includes("--seq-affordability-"))).toBe(
      true,
    );
  });

  it("gives two measures in the same group the same ramp", () => {
    // A shade per metric would leave a reader unable to tell "a different measure" from
    // "a different figure", which is the one thing the ramp exists to say.
    expect(rampFor("zhvi_sfr")).toEqual(rampFor("acs_median_home_value"));
  });

  it("draws an unlisted measure rather than dropping it", () => {
    expect(rampFor("something_new")).toEqual(rampFor("zhvi_sfr"));
  });
});

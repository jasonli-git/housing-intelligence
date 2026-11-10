import { describe, expect, it } from "vitest";
import { previewShades } from "./atlasPreviews";
import { catalogueIds, suggestionIds } from "./atlasCatalogue";

describe("layer tile shades", () => {
  const towns = [1, 2, 3, 4, 5, 6].map((id) => ({ id, parent: id <= 3 ? 10 : 20 }));
  it("shades towns by fifths and leaves a missing figure missing", () => {
    const values = new Map([[1, 100], [2, 200], [3, 300], [4, 400], [5, 500]]);
    expect(previewShades(towns, values, false)).toBe("01234-");
  });
  it("gives each town its county's shade when only counties are published", () => {
    const shades = previewShades(towns, new Map([[10, 1], [20, 2], [30, 3], [40, 4], [50, 5]]), true);
    expect(shades).toBe("000111");
  });
});

describe("the atlas catalogue", () => {
  it("shows a variant set once, by its first member published", () => {
    expect(catalogueIds(["zhvi_sfr", "acs_median_home_value", "acs_median_rent_2br", "acs_median_gross_rent"])).toEqual(["zhvi_sfr", "acs_median_gross_rent"]);
    expect(catalogueIds(["acs_median_home_value"])).toEqual(["acs_median_home_value"]);
  });
  it("leaves a duplicate out only where its replacement is published", () => {
    expect(catalogueIds(["acs_population", "pep_population"])).toEqual(["pep_population"]);
    expect(catalogueIds(["acs_population"])).toEqual(["acs_population"]);
    expect(catalogueIds(["nj_director_ratio", "nj_effective_tax_rate"])).toEqual(["nj_effective_tax_rate"]);
  });
  it("lets a suggestion stand for its whole variant set", () => {
    expect(suggestionIds("fema_flood_homes_share")).toContain("njdep_tidal_homes_share");
    expect(suggestionIds("acs_median_hh_income")).toEqual(["acs_median_hh_income"]);
  });
});

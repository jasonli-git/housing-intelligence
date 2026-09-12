import { describe, expect, it } from "vitest";

import { byInstitution, isRestricted, licenceLine } from "@/lib/sources";

const PD = "Public domain (U.S. Government work)";
const NC = "Free for non-commercial use with attribution";

function source(source_id: string, publisher: string, license = PD) {
  return { source_id, name: source_id, publisher, license, homepage: "https://x", cadence: "annual" };
}

describe("byInstitution", () => {
  it("groups by publisher in the order each first appears", () => {
    const groups = byInstitution([
      source("census_acs", "Census"),
      source("hud_fmr", "HUD"),
      source("census_permits", "Census"),
    ]);

    expect(groups.map((g) => g.publisher)).toEqual(["Census", "HUD"]);
    expect(groups[0].sources.map((s) => s.source_id)).toEqual(["census_acs", "census_permits"]);
  });

  it("hoists a licence the whole group shares and leaves a mixed one per source", () => {
    const [shared, mixed] = byInstitution([
      source("zhvi", "Zillow", NC),
      source("zori", "Zillow", NC),
      source("a", "Mixed", PD),
      source("b", "Mixed", NC),
    ]);

    expect(shared.license).toBe(NC);
    expect(mixed.license).toBeNull();
  });

  it("drops no source", () => {
    const all = [source("a", "X"), source("b", "Y"), source("c", "X"), source("d", "Z")];
    expect(byInstitution(all).flatMap((g) => g.sources)).toHaveLength(all.length);
  });
});

describe("isRestricted", () => {
  it("recognises non-commercial terms", () => {
    expect(isRestricted({ license: NC })).toBe(true);
    expect(isRestricted({ license: PD })).toBe(false);
  });
});

describe("licenceLine", () => {
  it("names one restricted source", () => {
    expect(licenceLine(["Zillow Home Value Index"])).toBe(
      "Zillow Home Value Index, and every figure derived from it, reports included.",
    );
  });

  it("names several, joined as prose", () => {
    expect(licenceLine(["A", "B", "C"])).toBe(
      "A, B and C, and every figure derived from them, reports included.",
    );
  });

  it("is absent when nothing is restricted", () => {
    expect(licenceLine([])).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import {
  addressCase,
  appealDeadline,
  describeBuilding,
  classPercentile,
  impliedValue,
  type ParcelFile,
  parcelsOf,
  revaluationIndicated,
  search,
} from "@/lib/parcels";

const FILE: ParcelFile = {
  geoid: "3401738100",
  municipality: "Hoboken",
  county: "Hudson",
  tax_year: 2024,
  assessment_ratio: { year: 2024, value: 50 },
  classes: { "2": "Residential, one to four families", "4A": "Commercial" },
  columns: [
    "block", "lot", "qualifier", "address", "class", "land", "improvement", "assessed",
    "tax", "year_built", "dwellings", "building",
  ],
  parcels: [
    ["12", "3", null, "250 LORRAINE DR", "2", 100000, 200000, 300000, 6000, 1960, 1, "2SF"],
    ["12", "3", "C0001", "250 LORRAINE DR UNIT 1", "2", 50000, 100000, 150000, 3000, 2009, 1, null],
    ["12", "4", null, "252 LORRAINE DR", "2", 120000, 280000, 400000, 8000, 1955, 1, null],
    ["13", "1", null, "1 WASHINGTON ST", "4A", 500000, 4500000, 5000000, 99000, null, null, null],
    ["14", "2", null, "300 LORRAINE AVE", "2", 80000, 120000, 200000, 4000, 1925, 2, null],
  ],
};

const PARCELS = parcelsOf(FILE);

describe("search", () => {
  it("finds a block and lot however it is written, qualifiers included", () => {
    for (const query of ["12/3", "12, 3", "block 12 lot 3", "12 lot 3"]) {
      expect(search(PARCELS, query).map((p) => p.qualifier)).toEqual([null, "C0001"]);
    }
  });

  it("finds nothing for an address, which the statewide address search answers", () => {
    expect(search(PARCELS, "250 lorraine")).toEqual([]);
  });

  it("stops at its limit and finds nothing for an empty query", () => {
    expect(search(PARCELS, "12/3", 1).length).toBe(1);
    expect(search(PARCELS, "  ")).toEqual([]);
  });
});

describe("impliedValue", () => {
  it("is the assessment over the Director's Ratio of its year", () => {
    expect(impliedValue(300000, FILE.assessment_ratio)).toBe(600000);
  });

  it("is nothing without a ratio or an assessment", () => {
    expect(impliedValue(300000, undefined)).toBeNull();
    expect(impliedValue(null, FILE.assessment_ratio)).toBeNull();
    expect(impliedValue(0, FILE.assessment_ratio)).toBeNull();
  });
});

describe("classPercentile", () => {
  it("compares a parcel only with its own class", () => {
    const house = PARCELS.find((p) => p.lot === "4")!;
    // Below it: the 300,000, 150,000 and 200,000 houses, of four houses. The
    // 5,000,000 commercial parcel is not a peer.
    expect(classPercentile(PARCELS, house)).toBe(75);
    const shop = PARCELS.find((p) => p.propertyClass === "4A")!;
    expect(classPercentile(PARCELS, shop)).toBeNull();
  });
});

describe("revaluationIndicated", () => {
  it("is at or below 85%, the threshold the state's rules name", () => {
    expect(revaluationIndicated({ year: 2025, value: 85 })).toBe(true);
    expect(revaluationIndicated({ year: 2025, value: 85.01 })).toBe(false);
    expect(revaluationIndicated(undefined)).toBeNull();
  });
});

describe("a parcel file", () => {
  it("carries no column that could name or reach an owner", () => {
    for (const column of FILE.columns) {
      expect(column).not.toMatch(/owner|mail|deed|zip|city/i);
    }
  });
});

describe("describeBuilding", () => {
  it("reads the common pieces of an assessor's code", () => {
    expect(describeBuilding("2SF2AG")).toBe("2-story, wood frame, 2-car attached garage");
    expect(describeBuilding("2S F G")).toBe("2-story, wood frame, garage");
    expect(describeBuilding("2.5SF1UG")).toBe("2½-story, wood frame, 1-car garage");
    expect(describeBuilding("2 1/2S B G2")).toBe("2½-story, brick, 2-car garage");
    expect(describeBuilding("2SFR2G")).toBe("2-story, wood frame, 2-car garage");
    expect(describeBuilding("BHG")).toBe("brick, garage");
    expect(describeBuilding("1F1G       1000")).toBe("1-story, wood frame, 1-car garage");
    expect(describeBuilding("COMMON ELEMENTS")).toBe("shared condo areas");
    expect(describeBuilding("TOWNHOUSE")).toBe("Townhouse");
    expect(describeBuilding("1S-F")).toBe("1-story, wood frame");
    expect(describeBuilding("2S.F.")).toBe("2-story, wood frame");
    expect(describeBuilding("2SAL-1BIG")).toBe("2-story, aluminum siding, 1-car built-in garage");
    expect(describeBuilding("1SCB")).toBe("1-story, concrete block");
    expect(describeBuilding("2F2G")).toBe("2-story, wood frame, 2-car garage");
  });
  it("leaves codes it cannot read whole", () => {
    for (const code of ["1S-F-S", "2SS-1BIG", "1BR", "2", "", null]) expect(describeBuilding(code)).toBeNull();
  });
});


describe("addressCase and appealDeadline", () => {
  it("writes addresses in ordinary case", () => {
    expect(addressCase("246 WITHERSPOON ST")).toBe("246 Witherspoon St");
    expect(addressCase("10 NE 2ND AVE")).toBe("10 NE 2nd Ave");
    expect(addressCase("ROUTE 9 & US HWY 1")).toBe("Route 9 & US Hwy 1");
  });
  it("gives each county its own appeal date", () => {
    expect(appealDeadline("Monmouth").date).toBe("January 15");
    expect(appealDeadline("Hunterdon").date).toBe("April 1");
    expect(appealDeadline("Sussex").note).toContain("May 1");
    expect(appealDeadline(null).date).toBe("April 1");
  });
});

import { describe, expect, it } from "vitest";

import {
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

  it("finds an address by whole words, the last allowed to be half-typed", () => {
    expect(search(PARCELS, "250 lorraine").length).toBe(2);
    expect(search(PARCELS, "250 lorr").length).toBe(2);
    expect(search(PARCELS, "lorraine ave").map((p) => p.lot)).toEqual(["2"]);
    expect(search(PARCELS, "50 lorraine")).toEqual([]);
    // A house number is whole: 25 is not 250 or 252.
    expect(search(PARCELS, "25 lorraine")).toEqual([]);
  });

  it("stops at its limit and finds nothing for an empty query", () => {
    expect(search(PARCELS, "lorraine", 2).length).toBe(2);
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

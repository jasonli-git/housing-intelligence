import { describe, expect, it } from "vitest";

import type { CommunityRecord, DistrictStatus, SchoolPerformance } from "@/lib/api";
import { districtCards, districtResults } from "@/lib/schools";

function rec<T>(payload: T): CommunityRecord<T> {
  return { payload } as CommunityRecord<T>;
}
const results = (id: string) =>
  rec<SchoolPerformance>({ district_id: id, name: "x", school_year: "2024-2025", url: "", notes: [], indicators: [] });
const status = (fields: Partial<DistrictStatus>) =>
  rec<DistrictStatus>({
    district_id: "25-0130", nces_id: "1", name: "x", status: "Open", agency_type: "", operational_schools: 1,
    grades: "PK-6", school_year: "2024-25", url: "", ...fields,
  });

describe("districtResults (#356)", () => {
  it("reads a district's own results as its own", () => {
    expect(districtResults("25-0130", results("25-0130"), null)).toEqual({ kind: "own" });
  });

  it("names the successor when a closed district's results are its successor's", () => {
    const closed = status({ status: "Closed", operational_schools: 0, successor: { district_id: "25-1456", name: "Henry Hudson Regional School District" } });
    expect(districtResults("25-0130", results("25-1456"), closed)).toEqual({
      kind: "merged", into: "Henry Hudson Regional School District", year: "2024-25",
    });
  });

  it("says a district running no schools has no results, rather than a blank", () => {
    expect(districtResults("01-0960", null, status({ district_id: "01-0960", operational_schools: 0 }))).toEqual({
      kind: "no_schools", year: "2024-25",
    });
  });

  it("leaves a district NCES does not explain unexplained", () => {
    expect(districtResults("01-0960", null, null)).toEqual({ kind: "unexplained" });
    expect(districtResults("01-0960", null, status({ status: "Closed", operational_schools: 0 }))).toEqual({ kind: "unexplained" });
  });
});

describe("districtCards (#356)", () => {
  const boundary = (id: string, type: string) =>
    rec({ district_id: id, name: `Old ${id}`, district_type: type });
  const closed = (id: string) =>
    status({ district_id: id, status: "Closed", operational_schools: 0, successor: { district_id: "25-1456", name: "Henry Hudson Regional School District" } });

  it("shows former districts that joined one successor once", () => {
    const cards = districtCards([
      { boundary: boundary("25-0130", "elementary"), performance: results("25-1456"), status: closed("25-0130") },
      { boundary: boundary("25-2120", "secondary"), performance: results("25-1456"), status: closed("25-2120") },
      { boundary: boundary("25-0180", "unified"), performance: results("25-0180"), status: null },
    ]);
    expect(cards).toHaveLength(2);
    expect(cards[0].formerly.map((b) => b.payload.district_id)).toEqual(["25-0130", "25-2120"]);
    expect(cards[1].formerly).toEqual([]);
  });
});


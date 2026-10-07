import { describe, expect, it } from "vitest";
import { matchingCounties } from "./countyPicker";

const counties = [{ id: 12, name: "Somerset County" }, { id: 5, name: "Atlantic County" }];
describe("county page discovery", () => {
  it("filters case-insensitively, sorts names and leaves its input intact", () => {
    expect(matchingCounties(counties, " ATL ")).toEqual([counties[1]]);
    expect(matchingCounties(counties, "").map((c) => c.id)).toEqual([5, 12]);
    expect(matchingCounties(counties, "missing")).toEqual([]);
    expect(counties[0].id).toBe(12);
  });
});

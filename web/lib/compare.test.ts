import { describe, expect, it } from "vitest";

import { COMPARE_SECTIONS, MAX_PLACES, parsePlaces, placesQuery } from "./compare";

describe("the compare page's address", () => {
  it("reads distinct region ids in order, at most four, dropping anything else", () => {
    expect(parsePlaces("?places=224,194,2768")).toEqual([224, 194, 2768]);
    expect(parsePlaces("?places=224,224,abc,-3,0,1.5,194")).toEqual([224, 194]);
    expect(parsePlaces("?places=1,2,3,4,5,6")).toHaveLength(MAX_PLACES);
    expect(parsePlaces("")).toEqual([]);
  });
  it("writes the same address back", () => {
    expect(placesQuery([224, 194])).toBe("?places=224,194");
    expect(placesQuery([])).toBe("");
    expect(parsePlaces(placesQuery([5, 194, 2768]))).toEqual([5, 194, 2768]);
  });
  it("reads each figure once", () => {
    const metrics = COMPARE_SECTIONS.flatMap((s) => s.rows).flatMap((r) => ("metric" in r ? [r.metric] : []));
    expect(new Set(metrics).size).toBe(metrics.length);
  });
});

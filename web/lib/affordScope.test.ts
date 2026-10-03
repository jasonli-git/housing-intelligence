import { describe, expect, it } from "vitest";
import type { Place } from "./afford";
import { affordScope } from "./affordScope";

const places: Place[] = [
  { id: 5, name: "Atlantic County", level: "county", detail: null, home: null, rent: null, tax: null },
  { id: 194, name: "Absecon", level: "municipality", parentId: 5, detail: "Atlantic County", home: null, rent: null, tax: null },
];
describe("budget explorer arrival scope", () => {
  it("starts statewide without a context", () => {
    expect(affordScope(new URLSearchParams(), places)).toEqual({ pickedId: null, countyId: null });
  });
  it("selects a town and its containing county", () => {
    expect(affordScope(new URLSearchParams("place=194"), places)).toEqual({ pickedId: 194, countyId: 5 });
  });
  it("selects a county from a county profile", () => {
    expect(affordScope(new URLSearchParams("place=5&county=5"), places)).toEqual({ pickedId: 5, countyId: 5 });
  });
  it("allows statewide comparison without losing the picked town", () => {
    expect(affordScope(new URLSearchParams("place=194&county=all"), places)).toEqual({ pickedId: 194, countyId: null });
  });
  it("ignores an unknown place and rejects a town as a county", () => {
    expect(affordScope(new URLSearchParams("place=999&county=194"), places)).toEqual({ pickedId: null, countyId: null });
  });
});

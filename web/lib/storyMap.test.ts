import { describe, expect, it } from "vitest";

import { arc, projector, shapes } from "./storyMap";

describe("story maps", () => {
  const square = { properties: { region_id: 7, name: "Square" }, geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] } };

  it("fits the outlines to the width, north up", () => {
    const p = projector([[[0, 0], [1, 1]]], 120, 10);
    expect(p.point([0, 1])).toEqual([10, 10]);
    expect(p.point([1, 0])).toEqual([110, 110]);
    expect(p.height).toBe(120);
  });

  it("draws each feature as a closed path with a centre", () => {
    const { shapes: out } = shapes([square], 120);
    expect(out[0].id).toBe(7);
    expect(out[0].d.startsWith("M")).toBe(true);
    expect(out[0].d.endsWith("Z")).toBe(true);
  });

  it("bends an arc off the straight line", () => {
    expect(arc([0, 0], [10, 0], 0.5)).toBe("M0 0Q5 5 10 0");
  });
});

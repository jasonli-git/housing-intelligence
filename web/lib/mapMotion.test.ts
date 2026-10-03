import { describe, expect, it } from "vitest";
import { flightTiming } from "./mapMotion";

const from = { lon: -74, lat: 40, scale: 100, width: 540, height: 580 };
describe("map flight timing", () => {
  it("uses the same short duration after repeated zoom clicks", () => {
    for (const presses of [1, 5, 10]) {
      expect(flightTiming(from, { ...from, scale: 100 * 1.4 ** presses }, true).duration).toBe(160);
    }
  });
  it("starts button motion promptly but retains gentle geographic jumps", () => {
    const to = { ...from, scale: 140 };
    expect(flightTiming(from, to, true).ease(.25)).toBeGreaterThan(.5);
    expect(flightTiming(from, to).ease(.25)).toBeLessThan(.1);
    expect(flightTiming(from, to).duration).toBeGreaterThan(420);
  });
  it("clamps both easing curves to their endpoints", () => {
    for (const quick of [true, false]) {
      const { ease } = flightTiming(from, from, quick);
      expect(ease(-1)).toBe(0);
      expect(ease(2)).toBe(1);
    }
  });
});

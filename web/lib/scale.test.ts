import { describe, expect, it } from "vitest";

import {
  classIndex,
  linearScale,
  nearestIndex,
  paddedExtent,
  quantileBreaks,
  sortedValues,
  straddlesZero,
} from "@/lib/scale";

/** The 5-year county changes that produced the blank map, rounded. */
const NJ_FIVE_YEAR = [
  48.7, 44.2, 42.1, 41.0, 40.3, 39.8, 38.9, 38.1, 37.7, 36.9, 36.2, 35.5, 34.8, 34.1,
  33.6, 33.0, 32.4, 31.8, 30.9, 29.7, 28.4,
];

describe("ramp selection", () => {
  it("does not diverge when every value shares a sign", () => {
    // The Milestone 5 bug: percentage change is signed, so a diverging ramp looks
    // right in the abstract. All 21 NJ counties rose, so centring on zero painted
    // every one of them the same step and the map conveyed nothing.
    expect(straddlesZero(sortedValues(NJ_FIVE_YEAR))).toBe(false);
  });

  it("diverges only when values actually cross zero", () => {
    expect(straddlesZero(sortedValues([-4, 2, 9]))).toBe(true);
    expect(straddlesZero(sortedValues([-9, -2, -1]))).toBe(false);
    expect(straddlesZero([])).toBe(false);
  });

  it("treats a value of exactly zero as not crossing", () => {
    expect(straddlesZero(sortedValues([0, 5, 9]))).toBe(false);
  });
});

describe("quantile breaks", () => {
  it("splits an all-positive distribution across all five classes", () => {
    // The regression guard: whatever the ramp, the classifier must separate regions
    // that share a sign. One class for 21 counties is the failure mode.
    const sorted = sortedValues(NJ_FIVE_YEAR);
    const breaks = quantileBreaks(sorted);

    const classes = new Set(sorted.map((value) => classIndex(value, breaks)));
    expect(classes.size).toBe(5);
  });

  it("returns four ascending cut points", () => {
    const breaks = quantileBreaks(sortedValues(NJ_FIVE_YEAR));

    expect(breaks).toHaveLength(4);
    expect([...breaks].sort((a, b) => a - b)).toEqual(breaks);
  });

  it("interpolates between neighbours rather than snapping to one", () => {
    // 0.2 * (5 - 1) = 0.8, so the first break sits four fifths of the way from 10
    // to 20.
    expect(quantileBreaks([10, 20, 30, 40, 50])[0]).toBeCloseTo(18, 10);
  });

  it("puts each class in roughly equal numbers", () => {
    const sorted = sortedValues(NJ_FIVE_YEAR);
    const breaks = quantileBreaks(sorted);
    const counts = [0, 0, 0, 0, 0];
    sorted.forEach((value) => (counts[classIndex(value, breaks)] += 1));

    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
  });
});

describe("classIndex", () => {
  const breaks = [10, 20, 30, 40];

  it("is upper-inclusive at each break", () => {
    expect(classIndex(10, breaks)).toBe(0);
    expect(classIndex(10.1, breaks)).toBe(1);
  });

  it("clamps the extremes into the first and last class", () => {
    expect(classIndex(-999, breaks)).toBe(0);
    expect(classIndex(999, breaks)).toBe(4);
  });

  it("puts everything in one class when there are no breaks", () => {
    expect(classIndex(5, [])).toBe(0);
  });
});

describe("linearScale", () => {
  it("maps the domain onto the range at both ends", () => {
    const scale = linearScale([0, 100], [0, 620]);

    expect(scale(0)).toBe(0);
    expect(scale(50)).toBe(310);
    expect(scale(100)).toBe(620);
  });

  it("inverts when the range is reversed, as an SVG y axis needs", () => {
    const y = linearScale([100, 200], [240, 12]);

    expect(y(100)).toBe(240);
    expect(y(200)).toBe(12);
  });

  it("does not divide by zero on a flat domain", () => {
    const scale = linearScale([7, 7], [0, 100]);

    expect(Number.isFinite(scale(7))).toBe(true);
  });
});

describe("paddedExtent", () => {
  it("leaves headroom without anchoring at zero", () => {
    const [low, high] = paddedExtent([400, 500]);

    expect(low).toBeCloseTo(392, 10);
    expect(high).toBeCloseTo(508, 10);
    expect(low).toBeGreaterThan(0);
  });

  it("gives a flat series a plottable height", () => {
    const [low, high] = paddedExtent([300, 300, 300]);

    expect(high).toBeGreaterThan(low);
  });

  it("survives an all-zero series", () => {
    const [low, high] = paddedExtent([0, 0]);

    expect(high).toBeGreaterThan(low);
  });
});

describe("nearestIndex", () => {
  const times = [0, 10, 20, 30];

  it("finds the closest point to the cursor", () => {
    expect(nearestIndex(times, 21)).toBe(2);
    expect(nearestIndex(times, -5)).toBe(0);
    expect(nearestIndex(times, 100)).toBe(3);
  });

  it("keeps the earlier point on an exact tie", () => {
    expect(nearestIndex(times, 15)).toBe(1);
  });
});

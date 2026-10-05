import { describe, expect, it } from "vitest";
import { boundCoverage, COVERAGE_HOME, COVERAGE_REGIONS, coverageScene, regionViewport, STATE_DESTINATIONS, zoomCoverage } from "./coverageMap";
import type { Outline } from "./globe";

const box = (id: string, lon: number, lat: number): Outline => ({ id, name: id, rings: [[lon, lat, lon + 1, lat, lon + 1, lat + 1, lon, lat + 1, lon, lat]] });

describe("national coverage locator", () => {
  it("only links New Jersey to a published state profile", () => {
    expect(STATE_DESTINATIONS).toEqual({ NJ: "/states/new-jersey" });
    expect(STATE_DESTINATIONS.PA).toBeUndefined();
  });
  it("handles missing map data without a bogus camera", () => {
    expect(coverageScene([])).toBeNull();
    expect(coverageScene([box("AK", -150, 60)])).toBeNull();
  });
  it("frames the lower 48 and raises availability, not a housing statistic", () => {
    const drawing = coverageScene([box("NJ", -75, 40), box("PA", -78, 40), box("CA", -120, 35), box("HI", -156, 20)])!;
    expect(drawing.states.map((state) => state.id)).not.toContain("HI");
    expect(drawing.states.find((state) => state.id === "NJ")?.lift).toBe(6);
    expect(drawing.states.find((state) => state.id === "PA")?.lift).toBe(0);
    expect(drawing.locator.every(Number.isFinite)).toBe(true);
  });
  it("centers the available state on first zoom and keeps it centered on repeated presses", () => {
    let viewport = COVERAGE_HOME;
    for (let n = 0; n < 5; n++) {
      viewport = zoomCoverage(viewport, 1.5, [780, 160]);
      expect(viewport.x + 780 * viewport.scale).toBeCloseTo(450);
      expect(viewport.y + 160 * viewport.scale).toBeCloseTo(240);
    }
    expect(viewport.scale).toBe(5);
  });
  it("zooms around the reader's center after panning rather than snapping back to NJ", () => {
    const current = { scale: 2, x: -450, y: -240 };
    const next = zoomCoverage(current, 1.5, [780, 160]);
    expect(next.x + ((450 - current.x) / current.scale) * next.scale).toBe(450);
    expect(next.y + ((240 - current.y) / current.scale) * next.scale).toBe(240);
  });
  it("bounds drag/zoom and restores the whole US at minimum zoom", () => {
    expect(boundCoverage({ scale: 2, x: -10000, y: 10000 })).toEqual({ scale: 2, x: -1350, y: 240 });
    expect(zoomCoverage({ scale: 1.5, x: -600, y: 0 }, .1, [780, 160])).toEqual(COVERAGE_HOME);
  });
  it("assigns all states and DC once without implying new coverage", () => {
    const codes = Object.values(COVERAGE_REGIONS).flat();
    expect(codes).toHaveLength(51);
    expect(new Set(codes).size).toBe(51);
    expect(COVERAGE_REGIONS.Northeast).toContain("NJ");
    expect(COVERAGE_REGIONS.West).toContain("AK");
    expect(Object.keys(STATE_DESTINATIONS)).toEqual(["NJ"]);
  });
  it("frames region geometry and handles an absent region honestly", () => {
    const outlines = [box("NJ", -75, 40), box("PA", -78, 40), box("CA", -120, 35), box("AK", -150, 60)];
    const viewport = regionViewport(outlines, "Northeast")!;
    expect(viewport.scale).toBeGreaterThan(1);
    expect(Object.values(viewport).every(Number.isFinite)).toBe(true);
    expect(regionViewport(outlines, "South")).toBeNull();
    expect(regionViewport([box("AK", -150, 60)], "West")).toBeNull();
    expect(regionViewport(outlines, "West")).toEqual(regionViewport(outlines.filter((o) => o.id !== "AK"), "West"));
  });
});

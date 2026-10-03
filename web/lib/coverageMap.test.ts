import { describe, expect, it } from "vitest";
import { coverageScene, STATE_DESTINATIONS } from "./coverageMap";
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
});

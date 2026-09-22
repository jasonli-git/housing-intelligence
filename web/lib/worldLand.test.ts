import { describe, expect, it } from "vitest";
import { WORLD_LAND } from "@/lib/worldLand";

describe("world land backdrop", () => {
  it("covers the globe rather than only the United States", () => {
    const points = WORLD_LAND.flatMap((outline) => outline.rings.flat());
    const longitudes = points.filter((_, index) => index % 2 === 0);
    const latitudes = points.filter((_, index) => index % 2 === 1);
    expect(WORLD_LAND.length).toBeGreaterThan(100);
    expect(Math.min(...longitudes)).toBeLessThan(-179);
    expect(Math.max(...longitudes)).toBeGreaterThan(179);
    expect(Math.min(...latitudes)).toBeLessThan(-80);
    expect(Math.max(...latitudes)).toBeGreaterThan(80);
  });
});


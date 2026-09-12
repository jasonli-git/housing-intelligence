import { describe, expect, it } from "vitest";

import { project } from "@/lib/geo";

const square = (id: number, lon: number, lat: number) => ({
  geometry: {
    type: "Polygon",
    coordinates: [[[lon, lat], [lon + 1, lat], [lon + 1, lat + 1], [lon, lat + 1], [lon, lat]]],
  },
  properties: { region_id: id, name: `R${id}` },
});

function coordinates(d: string): number[][] {
  return [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

describe("project", () => {
  it("fits every point inside the box", () => {
    const { shapes } = project([square(1, -75, 39), square(2, -74, 40)], 300, 400);

    for (const [x, y] of shapes.flatMap((s) => coordinates(s.d))) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(300);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(400);
    }
  });

  it("puts north at the top", () => {
    const { shapes } = project([square(1, -75, 39), square(2, -75, 41)], 300, 400);
    const top = (d: string) => Math.min(...coordinates(d).map(([, y]) => y));

    expect(top(shapes[1].d)).toBeLessThan(top(shapes[0].d));
  });

  it("draws a MultiPolygon as one path of several rings", () => {
    const multi = {
      geometry: {
        type: "MultiPolygon",
        coordinates: [square(0, -75, 39).geometry.coordinates, square(0, -73, 39).geometry.coordinates],
      },
      properties: { region_id: 9, name: "Islands" },
    };

    const [shape] = project([multi], 300, 400).shapes;

    expect(shape.d.match(/M/g)).toHaveLength(2);
    expect(shape).toMatchObject({ id: 9, name: "Islands" });
  });
});

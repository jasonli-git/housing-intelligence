import { describe, expect, it } from "vitest";

import { PRECISION, pack, unpack } from "@/lib/mapdata";

function collection(
  properties: Record<string, unknown>,
  coordinates: number[][],
  type = "Polygon",
) {
  return {
    features: [
      {
        properties,
        geometry: {
          type,
          coordinates: type === "Polygon" ? [coordinates] : [[coordinates]],
        },
      },
    ],
  };
}

const NJ = [
  [-74.5001, 40.2002],
  [-74.4999, 40.2003],
  [-74.4998, 40.1999],
];

describe("packing the map's outlines", () => {
  it("comes back where it went in, within the precision it stores", () => {
    const [outline] = unpack(
      pack(collection({ region_id: 7, name: "Somewhere" }, NJ), "region_id"),
    );

    expect(outline.id).toBe(7);
    for (let i = 0; i < NJ.length; i += 1) {
      expect(outline.rings[0][i * 2]).toBeCloseTo(NJ[i][0], 4);
      expect(outline.rings[0][i * 2 + 1]).toBeCloseTo(NJ[i][1], 4);
    }
  });

  it("stores each point as a small step from the last, not as its own coordinate", () => {
    const [packed] = pack(
      collection({ region_id: 7, name: "Somewhere" }, NJ),
      "region_id",
    );

    // The first pair is absolute and seven digits; every pair after it is a delta of a
    // few units, which is the whole reason the file is 393KB rather than 750KB.
    expect(packed.rings[0].slice(0, 2)).toEqual([-745001, 402002]);
    expect(packed.rings[0].slice(2).every((step) => Math.abs(step) < 100)).toBe(
      true,
    );
  });

  it("keeps the name that identifies apart from the name that is read", () => {
    const [packed] = pack(
      collection(
        { region_id: 7, name: "Washington", name_lsad: "Washington township" },
        NJ,
      ),
      "region_id",
    );

    expect(packed.name).toBe("Washington");
    expect(packed.label).toBe("Washington township");
  });

  it("carries no second name when the first already identifies", () => {
    const [packed] = pack(
      collection({ region_id: 7, name: "Mercer", name_lsad: "Mercer" }, NJ),
      "region_id",
    );

    expect(packed.label).toBeUndefined();
  });

  it("keys the backdrop by its own code, since no region answers to it", () => {
    const [packed] = pack(collection({ code: "OH", name: "Ohio" }, NJ), "code");

    expect(packed.id).toBe("OH");
  });

  it("flattens a MultiPolygon, which simplification turns some Polygons into", () => {
    const [outline] = unpack(
      pack(
        collection({ region_id: 7, name: "Somewhere" }, NJ, "MultiPolygon"),
        "region_id",
      ),
    );

    expect(outline.rings).toHaveLength(1);
    expect(outline.rings[0]).toHaveLength(NJ.length * 2);
  });

  it("stores ten-thousandths of a degree, about eleven metres", () => {
    // Finer than the 0.0002-degree simplification the publisher's geometry arrives with,
    // so the rounding loses nothing that was there.
    expect(PRECISION).toBe(0.0001);
  });
});

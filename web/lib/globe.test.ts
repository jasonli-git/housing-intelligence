import { describe, expect, it } from "vitest";

import {
  type Camera,
  type Outline,
  at,
  clipToHorizon,
  fit,
  prism,
  rotate,
  scene,
  screen,
  view,
  warm,
} from "@/lib/globe";

const FRAME = { width: 600, height: 600 };

function camera(lon: number, lat: number, scale = 300): Camera {
  return { lon, lat, scale, width: FRAME.width, height: FRAME.height };
}

/** A square of side `size` degrees, centred on a point. Rings are flat, as the map's are. */
function box(
  lon: number,
  lat: number,
  size: number,
  id: number | string = 1,
): Outline {
  const h = size / 2;
  return {
    id,
    name: `box ${id}`,
    rings: [
      [lon - h, lat - h, lon + h, lat - h, lon + h, lat + h, lon - h, lat + h],
    ],
  };
}

describe("the camera", () => {
  it("puts the point it is centred on in the middle of the frame", () => {
    const c = camera(-74.5, 40);
    const [x, y] = screen(view(c), rotate(c, [-74.5, 40]));

    expect(x).toBeCloseTo(300, 6);
    expect(y).toBeCloseTo(300, 6);
  });

  it("sends the far side of the earth behind the globe", () => {
    const c = camera(0, 0);

    // A quarter turn away is exactly on the limb; anything further is behind it.
    expect(rotate(c, [90, 0])[2]).toBeCloseTo(0, 6);
    expect(rotate(c, [150, 0])[2]).toBeLessThan(0);
    expect(rotate(c, [10, 0])[2]).toBeGreaterThan(0);
  });
});

describe("curvature", () => {
  it("compresses the ground as it turns away from the viewer", () => {
    const c = camera(-98, 39);
    const v = view(c);
    const middle = screen(v, rotate(c, [-98, 39]))[0];
    const near = screen(v, rotate(c, [-123, 39]))[0];
    const far = screen(v, rotate(c, [-148, 39]))[0];

    // Two equal steps of 25 degrees. On a flat map they would cover equal screen
    // distance; on a globe the second is shorter, because that ground is turning away.
    expect(middle - near).toBeGreaterThan(0);
    expect(far - near).toBeLessThan(0);
    expect(near - far).toBeLessThan(middle - near);
  });

  it("bows a line of constant latitude, which a flat projection draws straight", () => {
    const c = camera(-98, 39);
    const v = view(c);
    const [, left] = screen(v, rotate(c, [-123, 39]));
    const [, middle] = screen(v, rotate(c, [-98, 39]));
    const [, right] = screen(v, rotate(c, [-73, 39]));

    expect(left).toBeCloseTo(right, 6);
    // The ends ride up the screen: they are further round the curve than the middle.
    expect(middle - left).toBeGreaterThan(10);
  });

  it("all but disappears over a single county", () => {
    const c = camera(-74.5, 40, 40000);
    const v = view(c);
    const [, left] = screen(v, rotate(c, [-74.7, 40]));
    const [, middle] = screen(v, rotate(c, [-74.5, 40]));
    const [, right] = screen(v, rotate(c, [-74.3, 40]));

    expect(left).toBeCloseTo(right, 6);
    // Under a pixel across a quarter-degree county, so the reader sees a flat map
    // where a flat map is the truthful thing to draw.
    expect(left - middle).toBeLessThan(1);
  });
});

describe("prisms", () => {
  it("raises the probe straight up the screen, wherever it stands", () => {
    const c = camera(-98, 39);
    const v = view(c);
    for (const where of [
      [-98, 39],
      [-123, 39],
      [-73, 45],
    ] as const) {
      const ground = screen(v, rotate(c, where));
      const lifted = screen(v, rotate(c, where), 100);

      // Not along the surface normal: at the centre of the view that normal points at
      // the camera and projects to nothing, so the rise is a stated convention.
      expect(lifted[0]).toBeCloseTo(ground[0], 6);
      expect(ground[1] - lifted[1]).toBeCloseTo(100, 6);
    }
  });

  it("warms every outline's cap without changing what is drawn", () => {
    const v = view({ lon: -74.5, lat: 40.2, scale: 900, width: 400, height: 400 });
    const here: Outline = {
      id: 1,
      name: "Here",
      rings: [[-74.51, 40.19, -74.49, 40.19, -74.49, 40.21, -74.51, 40.21]],
    };
    const away: Outline = {
      id: 2,
      name: "Away",
      rings: [[100, 10, 101, 10, 101, 11, 100, 11]],
    };
    const cold = scene(v, [here, away], () => 0);
    warm(v, [here, away]);
    const warmed = scene(v, [here, away], () => 0);
    expect(warmed.map((s) => s.base)).toEqual(cold.map((s) => s.base));
    // The one on the far side of the globe is culled either way.
    expect(warmed).toHaveLength(1);
  });

  it("draws walls only when there is height, and the top is the base until then", () => {
    const c = camera(-74.5, 40);
    const flat = prism(view(c), box(-74.5, 40, 0.4), 0)!;
    const tall = prism(view(c), box(-74.5, 40, 0.4), 60)!;

    expect(flat.walls).toBe("");
    expect(flat.top).toBe(flat.base);
    expect(tall.walls).not.toBe("");
    expect(tall.top).not.toBe(tall.base);
  });

  it("shows the wall the rise exposes, and not the ones it does not", () => {
    const c = camera(-74.5, 40);
    const tall = prism(view(c), box(-74.5, 40, 0.4), 60)!;

    // Rising straight up the screen, a square shows its south face; its east and west
    // walls are edge-on and its north wall is behind the top.
    expect(tall.walls.match(/M/g)).toHaveLength(1);
  });

  it("picks the same walls however the publisher wound the ring", () => {
    const c = camera(-74.5, 40);
    const forward = box(-74.5, 40, 0.4);
    const reversed: Outline = {
      ...forward,
      rings: forward.rings.map((flat) => {
        const pairs: number[][] = [];
        for (let i = 0; i < flat.length; i += 2)
          pairs.push([flat[i], flat[i + 1]]);
        return pairs.reverse().flat();
      }),
    };

    // Compared as sets of corners: reversing the ring draws the same wall the other way
    // round, which is the same wall.
    const walls = (outline: Outline) =>
      prism(view(c), outline, 60)!
        .walls.split(" ")
        .map((subpath) =>
          subpath.replace(/[MLZ]/g, " ").trim().split(/\s+/).sort().join("|"),
        )
        .sort();

    expect(walls(reversed)).toEqual(walls(forward));
    expect(walls(forward)).toHaveLength(1);
  });

  it("is nothing at all when it sits behind the globe", () => {
    const c = camera(0, 0);

    expect(prism(view(c), box(170, 0, 1), 20)).toBeNull();
  });
});

describe("clipping", () => {
  it("cuts a ring at the horizon and leaves the cut on the limb", () => {
    const c = camera(0, 0);
    const straddling = [
      rotate(c, [80, 0]),
      rotate(c, [100, 0]),
      rotate(c, [100, 10]),
      rotate(c, [80, 10]),
    ];

    const kept = clipToHorizon(straddling);
    expect(kept.length).toBeGreaterThan(2);
    for (const point of kept) {
      expect(point[2]).toBeGreaterThanOrEqual(-1e-9);
      // Pushed back out to the sphere, or the cut edge would notch inside the limb.
      expect(Math.hypot(point[0], point[1], point[2])).toBeCloseTo(1, 6);
    }
  });
});

describe("the scene", () => {
  it("draws the far regions before the near ones", () => {
    const c = camera(-74.5, 40);
    const near = box(-74.5, 40, 0.4, "near");
    const far = box(-70, 40, 0.4, "far");

    expect(scene(view(c), [far, near], () => 0).map((p) => p.id)).toEqual([
      "far",
      "near",
    ]);
  });

  it("draws whatever is raised last, however far away it is", () => {
    const c = camera(-74.5, 40);
    const here = box(-74.5, 40, 0.4, "here");
    const away = box(-70, 40, 0.4, "away");

    // Square to the ground, two regions the same distance either side of the centre sit
    // at the same depth, so depth alone cannot keep the probe in front.
    const order = scene(view(c), [here, away], (id) =>
      id === "away" ? 40 : 0,
    );
    expect(order.map((p) => p.id)).toEqual(["here", "away"]);
  });

  it("leaves out what the viewer cannot see", () => {
    const c = camera(0, 0);

    expect(
      scene(view(c), [box(0, 0, 2, "near"), box(175, 0, 2, "far")], () => 0),
    ).toHaveLength(1);
  });
});

describe("what is under a point", () => {
  it("answers with the region whose ground covers it", () => {
    const c = camera(-74.5, 40);
    const v = view(c);

    expect(at(v, [box(-74.5, 40, 1)], [300, 300])?.id).toBe(1);
  });

  it("answers with nothing when the point is off every region", () => {
    const c = camera(-74.5, 40);

    expect(at(view(c), [box(-74.5, 40, 0.05)], [10, 10])).toBeNull();
  });

  it("tests the ground, not the block standing on it", () => {
    const c = camera(-74.5, 40);
    const v = view(c);
    const here = box(-74.5, 40, 0.4);
    const top = prism(v, here, 200)!.top;

    // The lifted top covers screen rows the footprint does not, and pointing there is
    // pointing at whatever the block is leaning over — not at this region.
    const above: [number, number] = [300, 300 - 150];
    expect(top).toContain("M");
    expect(at(v, [here], above)).toBeNull();
  });
});

describe("framing", () => {
  it("fits everything inside the frame", () => {
    const c = fit([box(-75, 39, 1, "a"), box(-74, 41, 1, "b")], FRAME);
    const v = view(c);

    for (const outline of [box(-75, 39, 1, "a"), box(-74, 41, 1, "b")]) {
      for (const flat of outline.rings) {
        for (let i = 0; i < flat.length; i += 2) {
          const [x, y] = screen(v, rotate(c, [flat[i], flat[i + 1]]));
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(FRAME.width);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(FRAME.height);
        }
      }
    }
  });

  it("centres on the ground covered even when it crosses the antimeridian", () => {
    // What Alaska's Aleutians do: longitudes come back as -179 and +179, and a
    // longitude box built from them spans the planet and centres on Mongolia.
    const c = fit([box(179, 52, 2, "west"), box(-179, 52, 2, "east")], FRAME);

    expect(Math.abs(c.lon)).toBeGreaterThan(179);
    expect(c.lat).toBeCloseTo(52, 0);
  });
});

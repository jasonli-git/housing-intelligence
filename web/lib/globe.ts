/**
 * The globe the map is drawn on: longitude and latitude to screen coordinates, and the
 * prisms that stand on it.
 *
 * Orthographic — the view looks at a sphere from infinitely far away, and the sphere
 * turns underneath it. That choice does three things at once. The curvature comes out of
 * the geometry rather than being drawn on, so it is strong across a continent and
 * invisible over one town with nothing to tune. Rotation happens in three dimensions, so
 * the antimeridian never arises and Alaska's Aleutians need no special case. And the far
 * side of the earth is simply behind the sphere, so hiding it is a sign test rather than
 * a clipping rectangle.
 *
 * The camera looks straight down at whatever it is centred on, with no tilt. The ground
 * in the middle of the frame is therefore square to the viewer and undistorted, and the
 * curve falls away evenly in every direction from it — the owner's ask, and the truthful
 * picture of standing over a point on a globe. An earlier version leaned the globe back
 * by 34 degrees so that extruded blocks would show their walls; nothing is extruded
 * across the map any more, so the lean bought nothing and cost the centre its flatness.
 *
 * Every function here is pure and every unit is explicit, so `globe.test.ts` exercises
 * the arithmetic with no DOM, the way `lib/scale.ts` does for the choropleth (#48).
 */

const DEG = Math.PI / 180;

/** A point on the unit sphere, after the camera's rotation. `z > 0` faces the viewer. */
export type Vec3 = readonly [number, number, number];

/** `[longitude, latitude]` in degrees, as GeoJSON orders them. */
export type LonLat = readonly [number, number];

export type Camera = {
  /** Longitude at the centre of the frame, degrees. */
  lon: number;
  /** Latitude at the centre of the frame, degrees. */
  lat: number;
  /** Screen pixels per sphere radius. Larger is closer in. */
  scale: number;
  width: number;
  height: number;
};

/** A camera with its trigonometry worked out once. */
export type View = {
  camera: Camera;
  /** Where the centre of the sphere lands on screen. Prisms lean away from this point. */
  origin: readonly [number, number];
};

export function view(camera: Camera): View {
  // With no tilt the point the camera is centred on is the sphere's near pole, so the
  // sphere's centre projects to the middle of the frame and nothing else has to move.
  return { camera, origin: [camera.width / 2, camera.height / 2] };
}

/**
 * A point on the unit sphere, turned so the camera's centre faces the viewer.
 *
 * Two rotations: about the north axis to bring the target longitude round to the front,
 * and about the east axis to bring the target latitude up to it. The target then sits at
 * (0, 0, 1), facing the viewer.
 */
export function rotate(camera: Camera, [lon, lat]: LonLat): Vec3 {
  const phi = lat * DEG;
  const cosPhi = Math.cos(phi);
  // Longitude is folded in here rather than rotated afterwards: the first rotation
  // reduces to a shift of the longitude, which is one subtraction instead of a matrix.
  const lambda = (lon - camera.lon) * DEG;
  const x = cosPhi * Math.sin(lambda);
  const y = Math.sin(phi);
  const z = cosPhi * Math.cos(lambda);

  const beta = camera.lat * DEG;
  const cosB = Math.cos(beta);
  const sinB = Math.sin(beta);
  return [x, y * cosB - z * sinB, y * sinB + z * cosB];
}

/**
 * Where a point lands on screen. `lift` raises it off the map, in screen pixels.
 *
 * Straight up the screen, not along the surface normal. With the camera looking square
 * at the ground it is centred on, that normal points at the viewer and projects to
 * nothing at all — there is no direction to lean in. Rising up the screen is a stated
 * convention rather than a projection, and it reads the way a card lifted off a page
 * does: the one region the reader is asking about comes up towards them.
 */
export function screen(v: View, [x, y]: Vec3, lift = 0): [number, number] {
  const r = v.camera.scale;
  return [v.origin[0] + r * x, v.origin[1] - r * y - lift];
}

/**
 * A ring cut down to the half of the sphere the viewer can see.
 *
 * Sutherland-Hodgman against the plane `z = 0`: an edge crossing the horizon gains a
 * point on it, and a ring wholly behind the globe comes back empty. The crossing point
 * is pushed back out to the sphere, or it would project inside the limb and notch the
 * outline.
 */
export function clipToHorizon(points: Vec3[]): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (a[2] > 0) out.push(a);
    if (a[2] > 0 !== b[2] > 0) {
      const t = a[2] / (a[2] - b[2]);
      const crossing: Vec3 = [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        0,
      ];
      const length = Math.hypot(crossing[0], crossing[1]) || 1;
      out.push([crossing[0] / length, crossing[1] / length, 0]);
    }
  }
  return out;
}

/** Twice a polygon's signed area on screen. Only its sign is ever used. */
function twiceArea(points: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    total += (x2 - x1) * (y2 + y1);
  }
  return total;
}

function path(points: [number, number][]): string {
  if (points.length === 0) return "";
  return `M${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}Z`;
}

/** One region's outlines, as longitude/latitude rings. */
export type Outline = {
  id: number | string;
  name: string;
  /** Parent county for a municipality. Absent at every other map level. */
  parent?: number;
  /** Each ring flat: `[lon, lat, lon, lat, ...]`. Flat because it halves the JSON. */
  rings: number[][];
};

/** A region drawn on the globe: the ground it covers, and the block standing on it. */
export type Prism = {
  id: number | string;
  name: string;
  /** The footprint on the ground. Also what a click or the crosshair tests against. */
  base: string;
  /** The top face, lifted. Equal to `base` when the region has no height. */
  top: string;
  /** The walls facing the viewer, one subpath each. Empty when there is no height. */
  walls: string;
  /** Distance from the camera, farthest first. Painter's order. */
  depth: number;
  /** How far this one was raised off the map, in screen pixels. 0 for flat ground. */
  lift: number;
};

/**
 * One region's prism, or `null` when it is behind the globe.
 *
 * `lift` is in screen pixels, measured at the centre of the frame; a region nearer the
 * limb is foreshortened, which is the point of drawing it on a sphere.
 *
 * Walls are chosen per edge by comparing the sign of the quad's area on screen with the
 * sign of its own ring's: a wall turned away from the viewer is drawn inside out, so the
 * two signs disagree. Comparing against the ring rather than testing for a fixed sign is
 * what makes it independent of how the publisher wound the ring — and it gets holes
 * right for free, since a hole winds the other way and the wall seen through it is the
 * one on its far side. They go into one path as separate subpaths, so a region is two
 * SVG elements however many sides it has.
 */
export function prism(v: View, outline: Outline, lift: number): Prism | null {
  const baseRings: [number, number][][] = [];
  const topRings: [number, number][][] = [];
  const quads: string[] = [];
  let depth = -Infinity;
  let anyVisible = false;

  for (const flat of outline.rings) {
    const rotated: Vec3[] = [];
    for (let i = 0; i < flat.length; i += 2) {
      rotated.push(rotate(v.camera, [flat[i], flat[i + 1]]));
    }
    const visible = clipToHorizon(rotated);
    if (visible.length < 3) continue;
    anyVisible = true;

    const base = visible.map((point) => screen(v, point));
    baseRings.push(base);
    for (const point of visible) depth = Math.max(depth, point[2]);

    if (lift === 0) continue;
    // Only built when there is a lift. At lift zero the top is the base, point for
    // point, and projecting it again was a second array and a second path string per
    // ring for every flat region on the map — which is all of them but one.
    const top = visible.map((point) => screen(v, point, lift));
    topRings.push(top);
    const facing = Math.sign(twiceArea(base));
    for (let i = 0; i < visible.length; i += 1) {
      const j = (i + 1) % visible.length;
      const quad: [number, number][] = [base[i], base[j], top[j], top[i]];
      if (Math.sign(twiceArea(quad)) !== facing) continue;
      quads.push(path(quad));
    }
  }

  if (!anyVisible) return null;
  // Built once and shared when the region is flat: `top` and `base` are then the same
  // string, and `toFixed` over forty thousand coordinates is the map's largest single
  // cost. Sharing it is also what the consumers already assume.
  const ground = baseRings.map(path).join(" ");
  return {
    id: outline.id,
    name: outline.name,
    lift,
    base: ground,
    top: lift === 0 ? ground : topRings.map(path).join(" "),
    walls: quads.join(" "),
    depth,
  };
}

/**
 * Every visible region, farthest from the camera first.
 *
 * A painter's order rather than a depth buffer: SVG has no depth, so a near region has
 * to be drawn over a far one. `depth` is the camera's own axis.
 *
 * Anything raised is drawn after everything flat, whatever its depth. With the camera
 * square to the ground, two regions the same angular distance north and south of the
 * centre sit at exactly the same depth, so depth alone cannot say that the one lifted
 * off the map belongs in front of its neighbours — and it always does, because it is
 * the region the reader is asking about.
 */
export function scene(
  v: View,
  outlines: Outline[],
  lift: (id: number | string) => number,
): Prism[] {
  const drawn: Prism[] = [];
  for (const outline of outlines) {
    if (!inFrame(v, outline)) continue;
    const shape = prism(v, outline, lift(outline.id));
    if (shape) drawn.push(shape);
  }
  return drawn.sort((a, b) => a.lift - b.lift || a.depth - b.depth);
}

/**
 * The smallest cap on the sphere that covers an outline: a direction and an angle.
 *
 * Cached per outline, because it depends on the ground and not on the camera. It is what
 * lets a frame skip a region without touching its points — one rotation against the
 * seventy-odd a municipality carries. At municipal zoom most of the state is off screen,
 * which is exactly where the map was slowest.
 */
const caps = new WeakMap<Outline, { v: Vec3; sin: number }>();

function capOf(outline: Outline): { v: Vec3; sin: number } {
  const known = caps.get(outline);
  if (known) return known;
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let n = 0;
  for (const flat of outline.rings) {
    for (let i = 0; i < flat.length; i += 2) {
      const phi = flat[i + 1] * DEG;
      const lambda = flat[i] * DEG;
      sx += Math.cos(phi) * Math.sin(lambda);
      sy += Math.sin(phi);
      sz += Math.cos(phi) * Math.cos(lambda);
      n += 1;
    }
  }
  const length = Math.hypot(sx, sy, sz) || 1;
  const centre: Vec3 = [sx / length, sy / length, sz / length];
  // The widest chord from that centre to any point, which bounds the cap. Chord rather
  // than angle: it needs no trigonometry and is monotonic in the angle.
  let far = 0;
  for (const flat of outline.rings) {
    for (let i = 0; i < flat.length; i += 2) {
      const phi = flat[i + 1] * DEG;
      const lambda = flat[i] * DEG;
      const x = Math.cos(phi) * Math.sin(lambda);
      const y = Math.sin(phi);
      const z = Math.cos(phi) * Math.cos(lambda);
      far = Math.max(
        far,
        Math.hypot(x - centre[0], y - centre[1], z - centre[2]),
      );
    }
  }
  const cap = { v: centre, sin: far };
  caps.set(outline, cap);
  return cap;
}

/**
 * Work out every outline's bounding cap now, rather than on the frame that needs it.
 *
 * `capOf` is memoised per outline and costs one pass of trigonometry over all its
 * points; over the 564 fine municipal outlines that is 2.9ms, and it falls due the first
 * time the camera reaches that level — which is the frame a zoom lands on, already the
 * busiest in the map's life. Called from an idle callback once the outlines arrive.
 *
 * The view is only somewhere to measure from; the caps do not depend on the camera,
 * which is the whole reason they can be cached.
 */
export function warm(v: View, outlines: Outline[]): void {
  for (const outline of outlines) inFrame(v, outline);
}

/**
 * Whether an outline could put anything inside the frame.
 *
 * Deliberately generous: it rejects only what certainly cannot be seen. A region wrongly
 * kept costs one region's work; a region wrongly dropped is a hole in the map.
 */
function inFrame(v: View, outline: Outline): boolean {
  const cap = capOf(outline);
  const [x, y, z] = rotateVec(v.camera, cap.v);
  // Behind the globe by more than its own extent: nothing of it can come round the limb.
  if (z < -cap.sin) return false;
  const reach = v.camera.scale * cap.sin;
  const [sx, sy] = screen(v, [x, y, z]);
  return (
    sx + reach >= 0 &&
    sx - reach <= v.camera.width &&
    sy + reach >= 0 &&
    sy - reach <= v.camera.height
  );
}

/** The camera's rotation applied to a point already on the unit sphere. */
function rotateVec(camera: Camera, [x, y, z]: Vec3): Vec3 {
  const beta = camera.lat * DEG;
  const cosB = Math.cos(beta);
  const sinB = Math.sin(beta);
  const lambda = -camera.lon * DEG;
  const cosL = Math.cos(lambda);
  const sinL = Math.sin(lambda);
  const rx = x * cosL + z * sinL;
  const rz = -x * sinL + z * cosL;
  return [rx, y * cosB - rz * sinB, y * sinB + rz * cosB];
}

/** Whether a screen point falls inside a ring, by ray casting. */
function inside(ring: [number, number][], [px, py]: [number, number]): boolean {
  let within = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      within = !within;
  }
  return within;
}

/**
 * The region whose ground covers a screen point — what the crosshair in the middle of
 * the frame is standing on.
 *
 * Tested against the footprint rather than the lifted top, because a reader pointing at
 * the map means a place on the ground, not the block above it. Nearest first, so where
 * a prism leans over its neighbour the neighbour still answers for its own ground.
 */
export function at(
  v: View,
  outlines: Outline[],
  point: [number, number],
): Outline | null {
  for (let i = outlines.length - 1; i >= 0; i -= 1) {
    const outline = outlines[i];
    if (!inFrame(v, outline)) continue;
    for (const flat of outline.rings) {
      const rotated: Vec3[] = [];
      for (let k = 0; k < flat.length; k += 2) {
        rotated.push(rotate(v.camera, [flat[k], flat[k + 1]]));
      }
      const visible = clipToHorizon(rotated);
      if (visible.length < 3) continue;
      if (
        inside(
          visible.map((p) => screen(v, p)),
          point,
        )
      )
        return outline;
    }
  }
  return null;
}

/**
 * A camera framing every outline given, with room around it.
 *
 * Measured on the sphere, not in a longitude/latitude box, because a box cannot hold
 * the United States: the Aleutians reach past 180 degrees, so their longitudes come
 * back as -179 and +179 and a naive box spans the planet and centres on Mongolia.
 * Summing the points' unit vectors has no such seam — the sum points at the middle of
 * the ground covered, wherever that ground is.
 *
 * The scale then comes from the projection rather than from the angular span: the two
 * differ once the ground curves away, and it is the projection that has to fit the
 * frame. Every offset from the centre of the frame is linear in the scale, so one pass
 * at scale 1 gives the answer for all of them.
 */
export function fit(
  outlines: Outline[],
  {
    width,
    height,
    padding = 0.92,
  }: { width: number; height: number; padding?: number },
): Camera {
  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (const outline of outlines) {
    for (const flat of outline.rings) {
      for (let i = 0; i < flat.length; i += 2) {
        const phi = flat[i + 1] * DEG;
        const lambda = flat[i] * DEG;
        sx += Math.cos(phi) * Math.sin(lambda);
        sy += Math.sin(phi);
        sz += Math.cos(phi) * Math.cos(lambda);
      }
    }
  }
  const lon = Math.atan2(sx, sz) / DEG;
  const lat = Math.atan2(sy, Math.hypot(sx, sz)) / DEG;

  const unit: Camera = { lon, lat, scale: 1, width, height };
  const probe = view(unit);
  let reachX = 1e-9;
  let reachY = 1e-9;
  for (const outline of outlines) {
    for (const flat of outline.rings) {
      for (let i = 0; i < flat.length; i += 2) {
        const [x, y] = screen(probe, rotate(unit, [flat[i], flat[i + 1]]));
        reachX = Math.max(reachX, Math.abs(x - width / 2));
        reachY = Math.max(reachY, Math.abs(y - height / 2));
      }
    }
  }
  return {
    lon,
    lat,
    scale: padding * Math.min(width / 2 / reachX, height / 2 / reachY),
    width,
    height,
  };
}

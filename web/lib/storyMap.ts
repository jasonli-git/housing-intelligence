/**
 * Flat maps of New Jersey for the visual stories: outlines drawn as SVG paths on the
 * server, so a story map ships no script. New Jersey spans a degree and a half of
 * latitude, so longitude scaled by the cosine of the middle latitude is close enough to
 * the true shape; the atlas's globe projection is for panning a whole country.
 */

export type Shape = { id: number; name: string; d: string; centre: [number, number] };
export type Projector = { point: (lonLat: [number, number]) => [number, number]; width: number; height: number };

type Geometry = { type: string; coordinates: unknown };
type Feature = { properties: Record<string, unknown>; geometry: Geometry };

/** A feature's rings, each a list of [lon, lat] pairs. */
export function ringsOf(geometry: Geometry): [number, number][][] {
  const polygons = (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates) as [number, number][][][];
  return polygons.flat();
}

/** A projector fitting every ring into a frame `width` wide, its height following the shape. */
export function projector(rings: [number, number][][], width: number, pad = 12): Projector {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const ring of rings) for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const scale = (width - 2 * pad) / ((maxLon - minLon) * k || 1);
  const height = Math.round((maxLat - minLat) * scale + 2 * pad);
  const point = ([lon, lat]: [number, number]): [number, number] => [
    Math.round((pad + (lon - minLon) * k * scale) * 10) / 10,
    Math.round((pad + (maxLat - lat) * scale) * 10) / 10,
  ];
  return { point, width, height };
}

/** Every feature as a path, with the mean of its points as a centre for labels and lines. */
export function shapes(features: Feature[], width: number, frame?: Projector): { shapes: Shape[]; projector: Projector } {
  const all = features.map((f) => ringsOf(f.geometry));
  const p = frame ?? projector(all.flat(), width);
  const out = features.map((f, i) => {
    let x = 0, y = 0, n = 0;
    const d = all[i]
      .map((ring) => ring.map((pt, j) => {
        const [px, py] = p.point(pt);
        x += px; y += py; n++;
        return `${j ? "L" : "M"}${px} ${py}`;
      }).join("") + "Z")
      .join("");
    return {
      id: Number(f.properties.region_id),
      name: String(f.properties.name ?? ""),
      d,
      centre: [Math.round((x / (n || 1)) * 10) / 10, Math.round((y / (n || 1)) * 10) / 10] as [number, number],
    };
  });
  return { shapes: out, projector: p };
}

/** A gentle arc from one point to another, bowed to the left of travel. */
export function arc([x1, y1]: [number, number], [x2, y2]: [number, number], bend = 0.2): string {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const cx = mx - (y2 - y1) * bend, cy = my + (x2 - x1) * bend;
  return `M${x1} ${y1}Q${Math.round(cx * 10) / 10} ${Math.round(cy * 10) / 10} ${x2} ${y2}`;
}

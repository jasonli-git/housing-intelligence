/**
 * Projection from GeoJSON to SVG path strings, separated from the map that draws them.
 *
 * Done once on the server: the New Jersey page hands its client map ready-made paths
 * rather than the 236KB county GeoJSON, which would otherwise ride along in every page
 * payload. Equirectangular with a cosine correction for the state's mid-latitude —
 * adequate for one state; a real projection would matter across the country.
 */

export type GeometryLike = { type: string; coordinates: number[][][] | number[][][][] };

export type FeatureLike = {
  geometry: GeometryLike;
  properties: { region_id: number; name: string };
};

export type Shape = { id: number; name: string; d: string };

export type Projected = { width: number; height: number; shapes: Shape[] };

/**
 * A feature's rings, whichever shape it arrived in. ST_SimplifyPreserveTopology can turn
 * a single-part MultiPolygon into a Polygon, so both genuinely occur in one response.
 */
function rings(geometry: GeometryLike): number[][][] {
  return geometry.type === "Polygon"
    ? (geometry.coordinates as number[][][])
    : (geometry.coordinates as number[][][][]).flat();
}

/** Every feature fitted and centred in a `width` × `height` box, as SVG paths. */
export function project(features: FeatureLike[], width: number, height: number): Projected {
  const points = features.flatMap((f) => rings(f.geometry).flat());
  const lons = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  const [minLon, maxLon] = [Math.min(...lons), Math.max(...lons)];
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];

  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const lonSpan = (maxLon - minLon) * Math.cos(midLat);
  const latSpan = maxLat - minLat;
  const scale = Math.min(width / lonSpan, height / latSpan);
  const offsetX = (width - lonSpan * scale) / 2;
  const offsetY = (height - latSpan * scale) / 2;

  const point = ([lon, lat]: number[]) =>
    `${((lon - minLon) * Math.cos(midLat) * scale + offsetX).toFixed(1)},` +
    `${((maxLat - lat) * scale + offsetY).toFixed(1)}`;

  return {
    width,
    height,
    shapes: features.map((f) => ({
      id: f.properties.region_id,
      name: f.properties.name,
      d: rings(f.geometry)
        .map((ring) => `M${ring.map(point).join("L")}Z`)
        .join(" "),
    })),
  };
}

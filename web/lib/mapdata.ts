/**
 * The one file the map fetches: three layers of outlines, and every measure's value for
 * the regions in them.
 *
 * A file, not page data. Next stores a client component's props in the flight payload
 * and the payload is written four times per page, so 42,000 coordinates carried in the
 * New Jersey page would be 168,000 — the cost the definitions trim measured and removed
 * (ARCHITECTURE #161). `search.json` set the pattern: a GET route handler becomes a file
 * in the export, and the browser asks for it when it needs it (#143).
 *
 * Coordinates are integers in ten-thousandths of a degree, delta-encoded along each
 * ring. The publisher's own geometry is simplified to 0.0002 degrees, so rounding to
 * 0.0001 loses nothing, and neighbouring points differ by a few units where the absolute
 * values need seven digits each.
 */

import type { Outline } from "@/lib/globe";

/** As much of a FeatureCollection as the packing needs. */
type GeoLike = {
  features: {
    properties: Record<string, unknown>;
    geometry: { type: string; coordinates: unknown };
  }[];
};

/** Degrees per stored unit. Coordinates are `Math.round(degrees / PRECISION)`. */
export const PRECISION = 0.0001;

/** One ring: `[lon0, lat0, dlon, dlat, dlon, dlat, ...]`, all in units of PRECISION. */
export type PackedRing = number[];

export type PackedOutline = {
  id: number | string;
  /** The bare name, which is what the map's readout wants: "Washington". */
  name: string;
  /**
   * The name that identifies, for a list: "Washington township, Warren". Absent when the
   * bare name already identifies. Six New Jersey municipalities are called Washington and
   * two of the townships share even their legal type, so the county is part of the
   * answer (#70, #143).
   */
  label?: string;
  rings: PackedRing[];
};

export type MapLayer = {
  /** What a region at this level is called, for the map's own labels. */
  noun: string;
  outlines: PackedOutline[];
};

export type MapFile = {
  precision: number;
  /** The whole country, for panning. Keyed by USPS code; these carry no measures. */
  nation: MapLayer;
  county: MapLayer;
  municipality: MapLayer;
  /**
   * The municipalities again, simplified far harder, for when the whole state is in
   * frame and all 564 are on screen at once.
   *
   * At 0.001 degrees they are 15,364 points against the fine layer's 41,609 — 37% of the
   * work for a difference nobody can see at that zoom, where a town is a few dozen
   * pixels across. Once the reader zooms in far enough for the detail to matter, most of
   * the state is off screen and the fine layer is cheap again because it is culled.
   */
  municipalityWide: MapLayer;
  /** metric_id -> region_id -> its latest value. Absent regions have no figure. */
  values: Record<string, Record<string, number>>;
  /**
   * metric_id -> window -> region_id -> percentage change over that window.
   *
   * What the map colors by, so the window control moves the map and not only the
   * ranking beside it. Rounded to a tenth of a percent, which is the precision the page
   * prints: at full precision these are 125KB where they are now 29KB gzipped.
   */
  changes: Record<string, Record<string, Record<string, number>>>;
};

/** What the map is drawing: a movement over a window, or a level where none is published. */
export type Basis = {
  values: Record<string, number>;
  kind: "change" | "level";
};

/**
 * The figures the map and the ranking beside it both draw.
 *
 * Change over the chosen window when the measure publishes one, because that is what
 * the window control selects and what the ranking lists — before this the control moved
 * the table and left the map identical, which is a control that lies. A measure with no
 * change for that window falls back to its latest level, and the legend says which it
 * is looking at rather than leaving the reader to guess.
 */
export function readingsFor(
  file: MapFile | null,
  metric: string,
  window: string,
): Basis {
  const change = file?.changes[metric]?.[window];
  if (change && Object.keys(change).length > 0)
    return { values: change, kind: "change" };
  return { values: file?.values[metric] ?? {}, kind: "level" };
}

function packRing(coordinates: number[][]): PackedRing {
  const out: PackedRing = [];
  let lastLon = 0;
  let lastLat = 0;
  for (const [lon, lat] of coordinates) {
    const x = Math.round(lon / PRECISION);
    const y = Math.round(lat / PRECISION);
    out.push(x - lastLon, y - lastLat);
    lastLon = x;
    lastLat = y;
  }
  return out;
}

/** Every ring of a feature, whichever shape the publisher sent it in. */
function ringsOf(geometry: {
  type: string;
  coordinates: unknown;
}): number[][][] {
  return geometry.type === "Polygon"
    ? (geometry.coordinates as number[][][])
    : (geometry.coordinates as number[][][][]).flat();
}

/**
 * A GeoJSON FeatureCollection as the map stores it. `key` names the property holding
 * the identity: `region_id` for a level the warehouse holds, `code` for the backdrop,
 * which has no region to answer to (migration 0012).
 */
export function pack(collection: GeoLike, key: string): PackedOutline[] {
  return collection.features.map((feature) => {
    const name = String(feature.properties.name);
    const lsad = feature.properties.name_lsad;
    return {
      id: feature.properties[key] as number | string,
      name,
      ...(typeof lsad === "string" && lsad !== name ? { label: lsad } : {}),
      rings: ringsOf(feature.geometry).map(packRing),
    };
  });
}

/** Undo `pack`, back to the flat longitude/latitude rings the globe projects. */
export function unpack(outlines: PackedOutline[]): Outline[] {
  return outlines.map((outline) => ({
    id: outline.id,
    name: outline.name,
    rings: outline.rings.map((ring) => {
      const flat: number[] = new Array(ring.length);
      let lon = 0;
      let lat = 0;
      for (let i = 0; i < ring.length; i += 2) {
        lon += ring[i];
        lat += ring[i + 1];
        flat[i] = lon * PRECISION;
        flat[i + 1] = lat * PRECISION;
      }
      return flat;
    }),
  }));
}

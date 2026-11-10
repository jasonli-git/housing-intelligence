/**
 * The atlas's layer tiles (owner, 2026-11-09): each measure in the catalogue is a small map
 * of New Jersey in its own shades, the way a map app previews its layers, so a reader sees where
 * a measure is high before choosing it. The shades are worked out when the site is built
 * (`app/atlas/previews.json`), from the same published figures and fifths the map uses,
 * and the browser only paints them onto the town outlines it already holds.
 */
import { quintileBreaks } from "./housingAtlas";
import type { Outline } from "./globe";

/**
 * One measure's tile: a shade per town, in the order of `PreviewFile.towns`, as one
 * character each — "0" lightest to "4" darkest, "-" no figure. A measure with no town
 * figures is shaded by county, each town taking its county's fifth, and says so.
 */
export type Preview = { level: "municipality" | "county"; shades: string };
export type PreviewFile = { towns: number[]; previews: Record<string, Preview> };

/**
 * Shades for every town. `values` is keyed by town, or by county when `byCounty`; `parents`
 * gives each town's county. Fifths of the places that have a figure, as the town map shades.
 */
export function previewShades(towns: { id: number; parent?: number }[], values: Map<number, number>, byCounty: boolean): string {
  const breaks = quintileBreaks([...values.values()]);
  return towns
    .map((town) => {
      const value = values.get(byCounty ? (town.parent ?? -1) : town.id);
      if (value === undefined || !Number.isFinite(value)) return "-";
      return String(breaks.length ? breaks.filter((b) => value >= b).length : 2);
    })
    .join("");
}

/**
 * The town outlines as canvas paths fitted to a square tile, drawn once and shared by every
 * tile. Plate carrée squeezed by the cosine of New Jersey's latitude, which at this size is
 * indistinguishable from the map's own projection.
 */
export function previewPaths(outlines: Outline[], size: number, padding = 3): Map<number, Path2D> {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const squeeze = Math.cos((40.1 * Math.PI) / 180);
  for (const o of outlines) for (const ring of o.rings) for (let i = 0; i + 1 < ring.length; i += 2) {
    const x = ring[i] * squeeze, y = -ring[i + 1];
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const scale = (size - 2 * padding) / Math.max(maxX - minX, maxY - minY);
  const dx = (size - (maxX - minX) * scale) / 2, dy = (size - (maxY - minY) * scale) / 2;
  const paths = new Map<number, Path2D>();
  for (const o of outlines) {
    const path = new Path2D();
    for (const ring of o.rings) for (let i = 0; i + 1 < ring.length; i += 2) {
      const x = dx + (ring[i] * squeeze - minX) * scale, y = dy + (-ring[i + 1] - minY) * scale;
      if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
    }
    paths.set(Number(o.id), path);
  }
  return paths;
}

import type { Measure, RankRow } from "./measures";
import type { WindowKey } from "./windows";

export type AtlasMeasure = Measure & { source: string; sourceUrl: string; definition: string; latest:{rows:RankRow[];start:null;end:string|null;periods:Record<string,string>} };
export type AtlasCounty = { id:number; name:string };
export type AtlasMode = "latest" | WindowKey;
// Mist to indigo (2026-10-15, #378): one hue, lightness falling at every step, so the
// order reads in either theme and in greyscale, and nothing else on the page competes.
export const ATLAS_COLORS = ["#e6e9f5","#bcc5e8","#8d9bd6","#6170c2","#3b479c"];


/** Latest and change are distinct records; never silently substitute one. */
export function atlasReading(measure:AtlasMeasure, mode:AtlasMode) {
  if(mode!=="latest") return measure.windows[mode] ?? null;
  return measure.latest;
}
export function atlasValue(row:RankRow | undefined, mode:AtlasMode):number|null {
  const value=mode==="latest" ? row?.latest : row?.change;
  return typeof value==="number" && Number.isFinite(value) ? value : null;
}
/** Linear relative scale for the selected measure/window only. Zero is valid;
 * missing is never mapped to the lowest color. No good/bad interpretation. */
export function atlasColor(value:number|null, values:number[]):string {
  if(value===null || !values.length) return "url(#atlas-missing)";
  const lo=Math.min(...values), hi=Math.max(...values);
  const bucket=hi===lo ? 2 : Math.min(4,Math.max(0,Math.floor((value-lo)/(hi-lo)*5)));
  return ATLAS_COLORS[bucket];
}

/** New Jersey's mapped levels beyond the states (Director Note "Visualizing the data"). */
export type AtlasLevel = "county" | "municipality" | "zip";
export const ATLAS_LEVELS: { key: AtlasLevel; label: string; noun: string; plural: string; outlines: string }[] = [
  { key: "county", label: "Counties", noun: "county", plural: "counties", outlines: "/atlas/counties.json" },
  { key: "municipality", label: "Towns", noun: "town", plural: "towns", outlines: "/atlas/municipalities.json" },
  { key: "zip", label: "ZIP codes", noun: "ZIP code", plural: "ZIP codes", outlines: "/atlas/zips.json" },
];

/** A measure the atlas can map, and the levels it is published for. Its figures load on demand. */
export type AtlasEntry = {
  metric_id: string;
  label: string;
  unit: string;
  direction: string;
  definition: string;
  source: string;
  sourceUrl: string;
  group: string;
  /** Each level's newest period end, which the latest figure is dated by. */
  lastPeriod: Partial<Record<AtlasLevel, string | null>>;
  levels: AtlasLevel[];
};

type PublishedRanking = {
  items: {
    region_id: number;
    name: string;
    rank: number;
    of: number;
    value: number;
    end_value: number | null;
    window_start: string | null;
    window_end: string | null;
    rank_best: number | null;
    rank_worst: number | null;
    margin_of_error: number | null;
    end_margin: number | null;
  }[];
};

/**
 * One measure at one level, read from the ranking files `hip publish` writes — the latest
 * value ranking and each window's change ranking — so the page carries no figures and a
 * measure costs a reader nothing until it is chosen. A value ranking holds no period per
 * row, so the date shown is the level's newest period end (`lastPeriod`).
 */
export async function loadAtlasMeasure(base: string, entry: AtlasEntry, level: AtlasLevel, windows: readonly WindowKey[]): Promise<AtlasMeasure> {
  const read = (path: string) =>
    fetch(`${base}/rankings/${entry.metric_id}/${level}/${path}`)
      .then((r) => (r.ok ? (r.json() as Promise<PublishedRanking>) : null))
      .catch(() => null);
  const [latest, ...changes] = await Promise.all([read("latest/value.json"), ...windows.map((w) => read(`${w}/change.json`))]);
  const measure: AtlasMeasure = {
    metric_id: entry.metric_id,
    label: entry.label,
    unit: entry.unit,
    direction: entry.direction,
    definition: entry.definition,
    source: entry.source,
    sourceUrl: entry.sourceUrl,
    windows: {},
    latest: {
      start: null,
      end: entry.lastPeriod[level] ?? null,
      periods: Object.fromEntries((latest?.items ?? []).flatMap((i) => (entry.lastPeriod[level] ? [[String(i.region_id), entry.lastPeriod[level]!]] : []))),
      rows: (latest?.items ?? []).map((i) => ({ id: i.region_id, name: i.name, rank: i.rank, of: i.of, change: 0, latest: i.value, latestMargin: i.margin_of_error })),
    },
  };
  windows.forEach((key, index) => {
    const items = (changes[index]?.items ?? []).filter((i) => i.window_start && i.window_end);
    if (!items.length) return;
    // A change map compares like periods, as the county map always has.
    const spans = items.map((i) => `${i.window_start}|${i.window_end}`);
    const common = [...new Set(spans)].sort((a, b) => spans.filter((s) => s === b).length - spans.filter((s) => s === a).length)[0];
    const rows = items.filter((i) => `${i.window_start}|${i.window_end}` === common);
    measure.windows[key] = {
      start: rows[0].window_start,
      end: rows[0].window_end,
      rows: rows.map((i) => ({ id: i.region_id, name: i.name, rank: i.rank, of: i.of, change: i.value, latest: i.end_value, best: i.rank_best, worst: i.rank_worst, latestMargin: i.end_margin, changeMargin: i.margin_of_error })),
    };
  });
  return measure;
}

/** The compare page's address for the places chosen on the map, at most its four. */
export function compareHref(ids: number[]): string {
  return `/compare?places=${ids.slice(0, 4).join(",")}`;
}

/**
 * The four values that split `values` into fifths. Towns and ZIP codes are skewed — Deal's
 * typical home at $4.6M against a median near $560k — so a linear scale paints nearly
 * every place the lightest shade; a shade per fifth of places keeps the map readable.
 */
export function quintileBreaks(values:number[]):number[] {
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted.length<5?[]:[1,2,3,4].map(i=>sorted[Math.floor(sorted.length*i/5)]);
}
export function atlasQuintileColor(value:number|null, breaks:number[]):string {
  if(value===null) return "url(#atlas-missing)";
  if(!breaks.length) return ATLAS_COLORS[2];
  return ATLAS_COLORS[breaks.filter(b=>value>=b).length];
}

/**
 * Zooming moves between the nation and the state (owner, 2026-10-22): zoom in on the
 * United States and New Jersey's map opens; zoom out of New Jersey and the nation returns.
 * Within New Jersey the layer — counties, towns or ZIP codes — is a switch, not a zoom, so
 * every layer can be seen whole. Entering and leaving happen at different zooms, so a zoom
 * resting near the boundary does not flicker.
 */
export type AtlasLayer = "states" | AtlasLevel;
export const MAX_ZOOM = 10;
const ENTER_STATE = 2.5;
const LEAVE_STATE = 0.85;

/** The layer a zoom calls for: `stateLayer` is the New Jersey layer to open on the way in. */
export function layerForZoom(current: AtlasLayer, zoom: number, stateLayer: AtlasLevel): AtlasLayer {
  if (current === "states") return zoom >= ENTER_STATE ? stateLayer : "states";
  return zoom < LEAVE_STATE ? "states" : current;
}

import type { Measure, RankRow } from "./measures";
import type { WindowKey } from "./windows";

export type AtlasMeasure = Measure & { source: string; sourceUrl: string; definition: string; latest:{rows:RankRow[];start:null;end:string|null;periods:Record<string,string>} };
export type AtlasCounty = { id:number; name:string };
export type AtlasMode = "latest" | WindowKey;
export const ATLAS_COLORS = ["#d2e5e9","#a4cbd4","#70a9ba","#3c819c","#17516d"];

/** Difference is descriptive, not evidence of statistical significance. */
export function atlasDifference(measure:AtlasMeasure,mode:AtlasMode,first:number,second:number) {
  const rows=atlasReading(measure,mode)?.rows;
  const a=atlasValue(rows?.find(row=>row.id===first),mode),b=atlasValue(rows?.find(row=>row.id===second),mode);
  if(a===null||b===null)return {value:null,reason:"A figure is unavailable."};
  if(mode==="latest"&&(!measure.latest.periods[first]||measure.latest.periods[first]!==measure.latest.periods[second]))return {value:null,reason:"Different dates; no difference calculated."};
  return {value:b-a,reason:null};
}

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

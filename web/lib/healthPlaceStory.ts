import type { PlaceStoryRecord, PlaceStorySummary } from "./placeStories";

export function healthStorySummary(record:PlaceStoryRecord):PlaceStorySummary {
  const c=record.community;
  const missing:PlaceStorySummary={available:false,headline:"Health estimates unavailable",period:"No matched estimates",source:"CDC PLACES",qualifier:"No other geography is substituted. Missing estimates are not zero.",rows:[]};
  if(!c||c.region_id!==record.place.region_id||!c.health_area||!c.health_level||!c.health.length)return missing;
  const records=c.health;
  const first=records[0].payload;
  if(records.some(r=>r.payload.year!==first.year||r.payload.release!==first.release)||new Set(records.map(r=>r.payload.measure)).size!==records.length)return missing;
  const rows=records.flatMap(({payload:h})=>h.value!==null&&Number.isFinite(h.value)&&h.value>=0&&h.value<=100?[{label:h.label,value:h.value,formatted:`${h.value.toFixed(1)}%`,aside:h.low!==null&&h.high!==null&&Number.isFinite(h.low)&&Number.isFinite(h.high)&&h.low>=0&&h.high<=100&&h.low<=h.value&&h.high>=h.value?`${h.confidence}% interval ${h.low.toFixed(1)}–${h.high.toFixed(1)}%`:"Uncertainty interval unavailable"}]:[]);
  if(!rows.length)return missing;
  const area=c.health_level==="county"?`${c.health_area.replace(/ County$/,"")} County`:c.health_area;
  return {available:true,headline:`${area}: health in context`,period:`${first.year} basis · ${first.release} release`,source:"CDC PLACES",qualifier:`${area} · ${c.health_level} model-based crude prevalence, not a local headcount${record.place.level==="municipality"&&c.health_level==="county"?" or measurements of this town":""}. Each measure has its own adult population; percentages cannot be added. Not a diagnosis, safety score or trend across releases.`,rows};
}

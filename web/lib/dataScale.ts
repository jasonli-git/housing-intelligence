import type { FreshnessReport, MetricEntry, Region } from "./api";
import { regionPath } from "./placeRoutes";

export type DataScale = { sources:number; observations:number; places:number; measures:number };

/** Different denominators, deliberately not a sum of raw release row counts. */
export function dataScale(metrics:MetricEntry[]|null, freshness:FreshnessReport|null, regions:Region[]):DataScale|null {
  if(!metrics || !freshness) return null;
  let observations=0;
  const seen=new Set<string>();
  for(const metric of metrics) {
    if(seen.has(metric.metric_id) || !Number.isSafeInteger(metric.observations) || metric.observations<0) return null;
    seen.add(metric.metric_id);observations+=metric.observations;
    if(!Number.isSafeInteger(observations)) return null;
  }
  const sources=new Set(freshness.sources.filter(s=>s.period_observed_start || s.period_observed_end).map(s=>s.source_id)).size;
  const places=new Set(regions.filter(r=>r.state_code==="NJ" && ["county","municipality","zip"].includes(r.level) && !regionPath(r.region_id).startsWith("/regions/")).map(r=>r.region_id)).size;
  if(!observations || !sources || !places) return null;
  return {sources,observations,places,measures:metrics.filter(m=>m.observations>0).length};
}

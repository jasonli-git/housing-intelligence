import {expect,it} from "vitest";
import type {SourceEntry,MetricEntry,Region} from "./api";
import {dataScale} from "./dataScale";
const metrics=[{metric_id:"a",observations:10},{metric_id:"b",observations:0}] as MetricEntry[];
const freshness=[{source_id:"a"},{source_id:"a"},{source_id:"boundary"},{source_id:"hip_derived"}] as SourceEntry[];
const places=[{region_id:5,state_code:"NJ",level:"county"},{region_id:224,state_code:"NJ",level:"municipality"},{region_id:1,state_code:"NJ",level:"state"},{region_id:999999,state_code:"NJ",level:"municipality"},{region_id:12,state_code:"PA",level:"county"}] as Region[];
it("counts distinct external datasets including supporting sources, not platform derivations",()=>{
 expect(dataScale(metrics,freshness,[...places,places[0]])).toEqual({sources:2,observations:10,places:2,measures:1});
});
it("does not turn unavailable coverage into zero or double-count duplicate metrics",()=>{
 expect(dataScale(null,freshness,places)).toBeNull();
 expect(dataScale(metrics,null,places)).toBeNull();
 expect(dataScale([...metrics,metrics[0]],freshness,places)).toBeNull();
 expect(dataScale([{metric_id:"a",observations:NaN}] as MetricEntry[],freshness,places)).toBeNull();
});

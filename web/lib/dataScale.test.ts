import {expect,it} from "vitest";
import type {FreshnessReport,MetricEntry,Region} from "./api";
import {dataScale} from "./dataScale";
const metrics=[{metric_id:"a",observations:10},{metric_id:"b",observations:0}] as MetricEntry[];
const freshness={sources:[{source_id:"a",period_observed_start:"2025-01-01"},{source_id:"a",period_observed_end:"2025-12-31"},{source_id:"unloaded",period_observed_start:null,period_observed_end:null}]} as FreshnessReport;
const places=[{region_id:5,state_code:"NJ",level:"county"},{region_id:224,state_code:"NJ",level:"municipality"},{region_id:1,state_code:"NJ",level:"state"},{region_id:999999,state_code:"NJ",level:"municipality"},{region_id:12,state_code:"PA",level:"county"}] as Region[];
it("uses distinct loaded sources and public NJ place pages with explicit metric-row counts",()=>{
 expect(dataScale(metrics,freshness,[...places,places[0]])).toEqual({sources:1,observations:10,places:2,measures:1});
});
it("does not turn unavailable coverage into zero or double-count duplicate metrics",()=>{
 expect(dataScale(null,freshness,places)).toBeNull();
 expect(dataScale(metrics,null,places)).toBeNull();
 expect(dataScale([...metrics,metrics[0]],freshness,places)).toBeNull();
 expect(dataScale([{metric_id:"a",observations:NaN}] as MetricEntry[],freshness,places)).toBeNull();
});

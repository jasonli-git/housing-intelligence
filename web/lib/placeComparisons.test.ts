import {it,expect} from "vitest";
import type {PacketLevel} from "./api";
import {comparisonMeasures} from "./placeComparisons";
const row=(metric_id:string,rank=2,direction="higher_is_better",ties=1)=>({metric_id,rank,direction,ties,of:10,value:100,survey:true}) as PacketLevel;
const empty={value:new Map(),change:new Map()};
it("maps lower values left and higher right across opposite rank directions",()=>{
 const items=comparisonMeasures([row('acs_median_hh_income',1),row('acs_renter_cost_burden',1,'lower_is_better')],empty);
 expect(items.map(i=>i.position)).toEqual([1,0]);
});
it("keeps survey uncertainty and ties rather than claiming a single rank",()=>{
 const [item]=comparisonMeasures([row('acs_median_hh_income',4,'higher_is_better',3)],{value:new Map([['acs_median_hh_income',{best:2,worst:5,margin:20}]]),change:new Map()});
 expect([item.best,item.worst]).toEqual([2,6]);expect(item.low).toBeLessThan(item.high);expect(item.margin).toBe(20);expect(item.rangeMissing).toBe(false);
});
it("omits missing/invalid ranks and uncurated repeats while naming absent uncertainty",()=>{
 expect(comparisonMeasures([row('zhvi_sfr'),row('acs_median_hh_income',0)],empty)).toEqual([]);
 expect(comparisonMeasures([row('acs_median_hh_income')],empty)[0].rangeMissing).toBe(true);
});

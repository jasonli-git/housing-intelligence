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
it("preserves the sidebar's property-record home age with survey age only as a fallback",()=>{
 const parcel={...row('modiv_median_year_built'),value:1958,survey:false};
 const survey={...row('acs_median_year_built'),value:1965};
 expect(comparisonMeasures([survey,parcel],empty).map(i=>i.row.metric_id)).toEqual(['modiv_median_year_built']);
 expect(comparisonMeasures([survey],empty)[0].row.metric_id).toBe('acs_median_year_built');
});
it("places the audited income marker at its point rank, inside the supplied rank interval",()=>{
 const income={...row('acs_median_hh_income',58),of:562,value:192079,margin_of_error:24402};
 const [item]=comparisonMeasures([income],{value:new Map([['acs_median_hh_income',{best:17,worst:107,margin:24402}]]),change:new Map()});
 expect(item.position).toBeCloseTo(1-57/561);
 expect(item.low).toBeCloseTo(1-106/561);expect(item.high).toBeCloseTo(1-16/561);
 expect(item.position).toBeGreaterThan(item.low);expect(item.position).toBeLessThan(item.high);
 expect(item.margin).toBe(24402);
});
it("ranks the supplied standout measures under their packet labels instead of the curated five",()=>{
 const tax={...row('modiv_median_tax_bill',8),label:'Annual property tax bill, typical home',survey:false};
 const items=comparisonMeasures([row('acs_median_hh_income'),tax],empty,['modiv_median_tax_bill','not_in_packet']);
 expect(items.map(i=>[i.row.metric_id,i.label])).toEqual([['modiv_median_tax_bill','Annual property tax bill, typical home']]);
 expect(comparisonMeasures([row('acs_median_hh_income')],empty,[])).toEqual([]);
});

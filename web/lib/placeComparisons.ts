import type {PacketLevel} from "./api";
import type {Uncertainties} from "./uncertainty";

export const COMPARISON_MEASURES=[
  ["acs_median_hh_income","Median household income"],
  ["acs_renter_cost_burden","Renters paying >30% of income"],
  ["acs_homeownership_rate","Owner-occupied homes"],
  ["acs_mean_commute_minutes","One-way commute"],
  ["modiv_median_year_built","Typical year built"],
] as const;

/** Always maps low values to the left, regardless of the publisher's rank direction. */
export function comparisonMeasures(levels:PacketLevel[],uncertainties:Uncertainties){
  return COMPARISON_MEASURES.flatMap(([id,label])=>{
    const row=levels.find(l=>l.metric_id===id)??(id==="modiv_median_year_built"?levels.find(l=>l.metric_id==="acs_median_year_built"):undefined);
    if(!row||!Number.isFinite(row.value)||row.rank===null||row.of===null||!Number.isInteger(row.rank)||!Number.isInteger(row.of)||row.of<2||row.rank<1||row.rank>row.of)return [];
    const u=uncertainties.value.get(row.metric_id);
    const valid=(v:number|null|undefined):v is number=>v!==null&&v!==undefined&&Number.isInteger(v)&&v>=1&&v<=row.of!;
    const surveyed=valid(u?.best)&&valid(u?.worst)&&u.best<=u.worst;
    const ties=row.ties&&Number.isInteger(row.ties)&&row.ties>1?row.ties:1;
    const best=Math.min(row.rank,surveyed?u.best!:row.rank);
    const worst=Math.min(row.of,Math.max(row.rank+ties-1,surveyed?u.worst!:row.rank));
    const position=(rank:number)=>row.direction==="lower_is_better"?(rank-1)/(row.of!-1):1-(rank-1)/(row.of!-1);
    return [{row,label,best,worst,position:position(row.rank),low:Math.min(position(best),position(worst)),high:Math.max(position(best),position(worst)),margin:u?.margin??row.margin_of_error??null,rangeMissing:row.survey&&!surveyed}];
  });
}

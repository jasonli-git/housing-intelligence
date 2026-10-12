import type { Metadata } from "next";
import Link from "next/link";
import { Masthead } from "@/components/Masthead";
import { HousingAtlas } from "@/components/HousingAtlas";
import { api, type Region, type MetricEntry, type SourceEntry } from "@/lib/api";
import { pageMetadata } from "@/lib/meta";
import { WINDOWS } from "@/lib/windows";
import { mapDefinitionOf } from "@/lib/mapDefinitions";
import type { AtlasMeasure } from "@/lib/housingAtlas";
import "./atlas.css";

export const metadata:Metadata=pageMetadata({title:"Housing atlas — Housing",description:"Explore New Jersey county housing figures on a synchronized map and comparison table.",path:"/atlas"});
const METRICS=["zhvi_sfr","zori_all","acs_median_hh_income","acs_median_gross_rent","acs_median_home_value","acs_renter_cost_burden","pep_population","permits_total_units"];
async function loadMeasures(level:"county"|"state",members:Region[],catalog:MetricEntry[],sources:SourceEntry[]) {
  const countyIds=new Set(members.map(r=>r.region_id));
  return (await Promise.all(catalog.filter(m=>METRICS.includes(m.metric_id)).map(async (metric):Promise<AtlasMeasure|null>=>{
    const windows:AtlasMeasure["windows"]={};
    const observations=await Promise.all(members.map(async county=>{
      const series=await api.observations(county.region_id,metric.metric_id);
      const latest=series?.observations.filter(o=>Number.isFinite(o.value)).sort((a,b)=>b.period_end.localeCompare(a.period_end))[0];
      return latest ? {county,latest} : null;
    }));
    const published=observations.filter(o=>o!==null);
    await Promise.all(WINDOWS.map(async ({key})=>{
      const ranking=await api.rankings(metric.metric_id,level,key,1000);
      const available=(ranking?.items??[]).filter(item=>countyIds.has(item.region_id)&&item.window_start&&item.window_end);
      // A change map compares like periods, not each county's own newest endpoints.
      const spans=available.map(item=>`${item.window_start}|${item.window_end}`);
      const common=[...new Set(spans)].sort((a,b)=>spans.filter(s=>s===b).length-spans.filter(s=>s===a).length)[0];
      const items=available.filter(item=>`${item.window_start}|${item.window_end}`===common);
      if(!items.length) return;
      windows[key]={start:items[0].window_start,end:items[0].window_end,rows:items.map(item=>({id:item.region_id,name:item.name,rank:item.rank,of:item.of,change:item.value,latest:item.end_value,best:item.rank_best,worst:item.rank_worst,latestMargin:item.end_margin,changeMargin:item.margin_of_error}))};
    }));
    if(!published.length && !Object.keys(windows).length) return null;
    const source=sources?.find(s=>s.source_id===metric.source_id);
    return {metric_id:metric.metric_id,label:metric.label,unit:metric.unit,direction:metric.direction,windows,definition:mapDefinitionOf(metric.metric_id)??metric.description,source:source?.name??metric.source_id,sourceUrl:source?.homepage??"",latest:{start:null,end:published.map(o=>o.latest.period_end).sort().at(-1)??null,periods:Object.fromEntries(published.map(o=>[o.county.region_id,o.latest.period_end])),rows:published.map(({county,latest})=>({id:county.region_id,name:county.name,rank:0,of:published.length,change:0,latest:latest.value,latestMargin:latest.margin_of_error}))}} satisfies AtlasMeasure;
  }))).filter((m):m is AtlasMeasure=>m!==null);
}
export default async function AtlasPage() {
  const [catalog,regions,stateRegions,sources]=await Promise.all([api.metrics(),api.regions("level=county&state=NJ&limit=100"),api.regions("level=state&limit=100"),api.sources()]);
  const [measures,stateMeasures]=await Promise.all([loadMeasures("county",regions?.items??[],catalog??[],sources??[]),loadMeasures("state",stateRegions?.items??[],catalog??[],sources??[])]);
  return <>
    <Masthead affordability={{kind:"route"}} atlasActive />
    <main id="main-content" tabIndex={-1} className="housing-atlas-page">
      <header className="atlas-title"><h1>Housing atlas</h1></header>
      {measures.length && stateMeasures.length && regions?.items.length ? <HousingAtlas measures={measures} stateMeasures={stateMeasures} states={(stateRegions?.items??[]).map(r=>({id:r.region_id,name:r.name,code:r.state_code??"NJ"}))} counties={regions.items.map(r=>({id:r.region_id,name:`${r.name.replace(/ County$/,"")} County`}))} /> : <p>Figures are unavailable in this build. <Link href="/states/new-jersey">Explore New Jersey instead.</Link></p>}
    </main>
  </>;
}

import type { Metadata } from "next";
import Link from "next/link";
import { Masthead } from "@/components/Masthead";
import { HousingAtlas } from "@/components/HousingAtlas";
import { api, artifactUrl, type Region, type MetricEntry, type SourceEntry } from "@/lib/api";
import { GROUPS } from "@/lib/groups";
import { pageMetadata } from "@/lib/meta";
import { WINDOWS } from "@/lib/windows";
import { mapDefinitionOf } from "@/lib/mapDefinitions";
import type { AtlasEntry, AtlasLevel, AtlasMeasure } from "@/lib/housingAtlas";
import "./atlas.css";
import "../income-pressure.css";
import "../horizon-theme.css";
import "./atlas-horizon.css";

export const metadata:Metadata=pageMetadata({title:"Housing atlas — Housing",description:"Explore New Jersey housing figures for every county, town and ZIP code on one map.",path:"/atlas"});
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
/**
 * Every measure the atlas can map in New Jersey, and the levels each is ranked at. Only
 * the list rides in the page; a measure's figures are read from its published ranking
 * files when a reader picks it (`loadAtlasMeasure`). One small request per measure and
 * level here, against the build's own API.
 */
async function loadEntries(catalog:MetricEntry[],sources:SourceEntry[]):Promise<AtlasEntry[]> {
  const groupOf=new Map(GROUPS.flatMap(g=>g.metrics.map(m=>[m,g.title] as const)));
  const levels:AtlasLevel[]=["county","municipality","zip"];
  const entries=await Promise.all(catalog.filter(m=>groupOf.has(m.metric_id)).map(async metric=>{
    // Each level's newest period end, from the top-ranked place's own series: the catalog
    // says when the newest period starts, and a five-year survey is labelled by its end.
    const found=await Promise.all(levels.map(async level=>{
      const top=(await api.values(metric.metric_id,level,1))?.items?.[0];
      if(!top)return null;
      const series=await api.observations(top.region_id,metric.metric_id);
      return [level,series?.observations.map(o=>o.period_end).sort().at(-1)??null] as const;
    }));
    const ranked=found.filter((f):f is readonly [AtlasLevel,string|null]=>f!==null);
    if(!ranked.length)return null;
    const source=sources.find(s=>s.source_id===metric.source_id);
    return {metric_id:metric.metric_id,label:metric.label,unit:metric.unit,direction:metric.direction,definition:mapDefinitionOf(metric.metric_id)??metric.description,source:source?.name??metric.source_id,sourceUrl:source?.homepage??"",group:groupOf.get(metric.metric_id)!,lastPeriod:Object.fromEntries(ranked),levels:ranked.map(([level])=>level)} satisfies AtlasEntry;
  }));
  return entries.filter((e):e is AtlasEntry=>e!==null);
}
export default async function AtlasPage() {
  const [catalog,regions,stateRegions,sources]=await Promise.all([api.metrics(),api.regions("level=county&state=NJ&limit=100"),api.regions("level=state&limit=100"),api.sources()]);
  const [entries,stateMeasures]=await Promise.all([loadEntries(catalog??[],sources??[]),loadMeasures("state",stateRegions?.items??[],catalog??[],sources??[])]);
  return <>
    <Masthead affordability={{kind:"route"}} atlasActive />
    <main id="main-content" tabIndex={-1} className="housing-atlas-page horizon-page" data-region-level="atlas">
      <header className="atlas-title"><div><h1>Housing atlas</h1><p className="atlas-lede">Every place’s figures on one map. Pick a measure, then tap a place.</p></div></header>
      {entries.length && stateMeasures.length && regions?.items.length ? <HousingAtlas entries={entries} artifactUrl={artifactUrl} stateMeasures={stateMeasures} states={(stateRegions?.items??[]).map(r=>({id:r.region_id,name:r.name,code:r.state_code}))} counties={regions.items.map(r=>({id:r.region_id,name:`${r.name.replace(/ County$/,"")} County`}))} /> : <p>Figures are unavailable in this build. <Link href="/states/new-jersey">Explore New Jersey instead.</Link></p>}
    </main>
  </>;
}

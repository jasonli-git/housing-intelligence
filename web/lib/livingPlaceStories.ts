import type { Utilities } from "./api";
import type { PlaceStoryRecord, PlaceStorySummary } from "./placeStories";
import { floodLevels, MAPPED_FLOOR } from "./hazards";
import { formatValue } from "./format";

const missing: PlaceStorySummary = { available:false, headline:"Local records unavailable",source:"Coverage limited",period:"No matching records",qualifier:"Missing records are not zero, safe conditions or available service. No other place has been substituted.",rows:[] };
export function electricRecords(data:Utilities|null|undefined) {
  const seen=new Set<string>();
  return (data?.providers??[]).flatMap(p=>{
    const e=p.electricity, key=e?`${e.record_id}:${e.payload.year}`:"";
    if(p.fuel!=="electric"||!e||seen.has(key))return [];
    seen.add(key);return [{name:p.provider,record:e}];
  }).sort((a,b)=>a.name.localeCompare(b.name));
}
export function livingStorySummary(record:PlaceStoryRecord):PlaceStorySummary|null {
  const row=(id:string)=>record.levels.find(l=>l.metric_id===id&&Number.isFinite(l.value));
  if(record.topic==="sites") {
    const open=row("njdep_sites_open");if(!open||open.value<0)return missing;
    return {available:true,headline:`${formatValue(open.value,"count")} site cleanups open in NJDEP’s records`,source:"NJDEP site records",period:`${open.period_end.slice(0,4)} record snapshot`,
      qualifier:"Records of sites, not affected homes or a measure of one address’s exposure. Categories may overlap; do not add them. Zero listed records is not a clean-property finding.",
      rows:[["njdep_sites_open","Open cleanups"],["njdep_sites_post_remedy","Managed with ongoing controls"],["njdep_sites_heating_oil","Leaking heating-oil tanks"]].flatMap(([id,label])=>{const l=row(id);return l&&l.value>=0&&l.period_start===open.period_start&&l.period_end===open.period_end?[{label,value:l.value,formatted:formatValue(l.value,"count")}]:[];})};
  }
  if(record.topic==="flood") {
    const f=floodLevels(record.levels),anchor=row("fema_flood_homes_share");
    if(!anchor||f.high===null||!Number.isFinite(f.high)||f.high<0||f.high>1||f.mapped===null||f.mapped<MAPPED_FLOOR)return {...missing,headline:"Flood-zone share unavailable",qualifier:"FEMA’s mapped coverage is missing or incomplete. Unmapped homes are not flood-free; check the actual address."};
    return {available:true,headline:`${(f.high*100).toFixed(1)}% of homes in FEMA’s 1%-a-year flood zone`,source:"FEMA NFHL / NJDEP",period:`Map copy ${anchor.period_end.slice(0,4)} · 2020 homes`,
      qualifier:"Estimated shares of homes, not land or one home’s risk. Outside a mapped zone is not safe from flooding. Claims count insured losses only; town estimates and county fallbacks are labeled separately below.",
      rows:[["1%-a-year zone",f.high],["0.2%-a-year zone",f.moderate]].flatMap(([label,value])=>typeof value==="number"&&Number.isFinite(value)&&value>=0&&value<=1?[{label:String(label),value,formatted:`${(value*100).toFixed(1)}%`}]:[])};
  }
  if(record.topic==="utilities") {
    const providers=electricRecords(record.utilities).filter(p=>p.record.payload.saidi_all!==null&&p.record.payload.saidi_all!==undefined&&Number.isFinite(p.record.payload.saidi_all)&&p.record.payload.saidi_all>=0);
    if(!providers.length)return {...missing,headline:"Verified outage records unavailable"};
    const years=[...new Set(providers.map(p=>p.record.payload.year))].sort((a,b)=>a-b);
    return {available:true,headline:providers.length===1?`${providers[0].record.payload.saidi_all!.toFixed(1)} minutes without power per customer`:`${providers.length} electricity providers with outage records`,source:"EIA-861 · Utility-wide",period:years.join(" / "),
      qualifier:`${providers.map(p=>p.name).join("; ")}. Annual utility-wide New Jersey averages, not town outages, current status or a prediction. All events and major-event exclusions are alternative bases, not quantities to add; reporting methods can differ.`,
      rows:providers.flatMap(p=>[["All events",p.record.payload.saidi_all],["Major-event days excluded",p.record.payload.saidi_normal]].flatMap(([basis,value])=>typeof value==="number"&&Number.isFinite(value)&&value>=0?[{label:`${p.name} · ${p.record.payload.year} · ${basis}`,value,formatted:`${value.toFixed(1)} min`,aside:`${p.record.payload.method??"Method not reported"} · SAIDI`}]:[]))};
  }
  if(record.topic==="broadband") {
    const c=record.community;if(!c||c.region_id!==record.place.region_id)return missing;
    const p=c.broadband_place?.payload;
    if(p) {
      if(!Number.isFinite(p.locations)||p.locations<=0||[p.fiber,p.unserved_wired,p.unserved_terrestrial].some(n=>!Number.isFinite(n)||n<0||n>p.locations))return missing;
      return {available:true,headline:`${(p.fiber/p.locations*100).toFixed(1)}% of mapped locations have a fiber offer`,source:"FCC provider reports",period:`${p.as_of} · revised ${p.revision}`,
        qualifier:`${p.locations.toLocaleString("en-US")} broadband-serviceable locations, not households or subscribers. Locations can contain many homes or none. Offers overlap; provider reports are not speed tests, prices or a guarantee at an address.`,
        rows:[{label:"Fiber offer",value:p.fiber/p.locations,formatted:`${(p.fiber/p.locations*100).toFixed(1)}%`},{label:"Wired offer · at least 100/20 Mbps",value:1-p.unserved_wired/p.locations,formatted:`${((1-p.unserved_wired/p.locations)*100).toFixed(1)}%`},{label:"Wired or fixed-wireless · at least 100/20 Mbps",value:1-p.unserved_terrestrial/p.locations,formatted:`${((1-p.unserved_terrestrial/p.locations)*100).toFixed(1)}%`}]};
    }
    // Published unit summaries can supply explicitly labeled county context for a
    // municipality. A ZIP without local records does not inherit a county percentage.
    if(record.place.level==="zip")return missing;
    const wired=c.broadband.find(r=>r.payload.technology==="All Wired")?.payload;
    const value=wired?.shares.speed_100_20;
    if(!wired||typeof value!=="number"||!Number.isFinite(value)||value<0||value>1)return missing;
    return {available:true,headline:`${wired.name}: ${(value*100).toFixed(1)}% of mapped units offered wired 100/20 Mbps`,source:`FCC · ${c.broadband_level??"Area"} unit summary`,period:`${wired.as_of} · revised ${wired.revision}`,
      qualifier:`${wired.name} published unit summary, not a town’s location count or an address guarantee. ${wired.total_units.toLocaleString("en-US")} FCC mapped units—not households. Availability is provider-reported, not measured speed.`,rows:[{label:"Wired · at least 100/20 Mbps",value,formatted:`${(value*100).toFixed(1)}%`}]};
  }
  return null;
}
export function livingPreviewNote(record:PlaceStoryRecord):string|null {
  switch(record.topic){
    case "health":return record.community?.health_level==="county"&&record.place.level==="municipality"?"County estimates—not measurements of this town.":"Modeled estimates—not a diagnosis or local headcount.";
    case "schools":return "Where students live—charter and vocational schools count as public.";
    case "sites":return "Site records—not a property’s exposure or safety.";
    case "flood":return "Mapped homes—not an address-specific risk assessment.";
    case "utilities":return "Utility-wide—not this town’s outage record.";
    case "broadband":return record.community?.broadband_place?"Mapped locations—not households or measured speeds.":"Published area context—not an address guarantee.";
    default:return null;
  }
}

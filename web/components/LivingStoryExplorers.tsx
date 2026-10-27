"use client";
import { useState } from "react";
import type { CommunityContext as CommunityData, Utilities as UtilityData } from "@/lib/api";
import { electricRecords } from "@/lib/livingPlaceStories";
import { CommunityContext } from "./CommunityContext";
import { StateBroadband } from "./StateBroadband";
import styles from "./PlaceStories.module.css";

export function UtilityOutageExplorer({data,idPrefix=""}:{data:UtilityData|null;idPrefix?:string}) {
  const [basis,setBasis]=useState<"all"|"normal">("all");
  const rows=electricRecords(data);
  const max=Math.max(1,...rows.flatMap(p=>[p.record.payload.saidi_all,p.record.payload.saidi_normal].filter((v):v is number=>typeof v==="number"&&Number.isFinite(v)&&v>=0)));
  return <section className={styles.livingExplorer} aria-labelledby={`${idPrefix}outage-explorer-heading`}><h2 id={`${idPrefix}outage-explorer-heading`}>What happens when major events are excluded?</h2>
    <div className={styles.explorerTabs} role="group" aria-label="Outage reporting basis">{(["all","normal"] as const).map(value=><button type="button" key={value} aria-pressed={basis===value} onClick={()=>setBasis(value)}>{value==="all"?"All events":"Major-event days excluded"}</button>)}</div>
    <p>Annual minutes without power per customer (SAIDI). Utility-wide New Jersey records; not the town’s outages. The scale stays fixed when the basis changes.</p>
    <div className={styles.explorerRows}>{rows.map(p=>{const e=p.record.payload,value=basis==="all"?e.saidi_all:e.saidi_normal;const valid=typeof value==="number"&&Number.isFinite(value)&&value>=0;return <div key={p.record.record_id}><span>{p.name} · {e.year}</span><b>{valid?`${value.toFixed(1)} min`:"Not reported"}</b><i aria-hidden="true"><span style={{width:valid?`${value/max*100}%`:"0%"}}/></i><small>{e.method??"Method not reported"} · {basis==="all"?"All events":"Major-event days excluded"}</small></div>;})}</div>
    {!rows.length&&<p>No verified electricity-company records matched this selection. Missing is not zero.</p>}
    <p>Methods and exclusions can differ between utilities. This is not a reliability ranking, current outage status or a prediction.</p>
  </section>;
}

export function BroadbandStoryExplorer({data,level,idPrefix=""}:{data:CommunityData|null;level:string;idPrefix?:string}) {
  const [basis,setBasis]=useState<"locations"|"units">(data?.broadband_place?"locations":"units");
  const area=data?.broadband.find(r=>r.payload.technology==="All Wired")?.payload.name??data?.broadband_area??"This area";
  return <section className={styles.livingExplorer} aria-label="Explore broadband measurement basis">
    <div className={styles.explorerTabs} role="group" aria-label="Broadband measurement basis"><button type="button" aria-pressed={basis==="locations"} disabled={!data?.broadband_place} onClick={()=>setBasis("locations")}>Mapped locations</button><button type="button" aria-pressed={basis==="units"} disabled={!data?.broadband.length} onClick={()=>setBasis("units")}>Published area units</button></div>
    <p>Locations can contain many units or none. These denominators cannot be exchanged or added.</p>
    {basis==="locations"?<CommunityContext data={data?{...data,broadband:[]}:null} level={level} topics={["broadband"]} idPrefix={idPrefix}/>:<>
      <h2>{area} · published {data?.broadband_level??"area"} units</h2>
      {level==="municipality"&&<p>County context—not this town’s location count or availability.</p>}
      <StateBroadband data={data?{...data,broadband_place:null}:null} name={area}/>
    </>}
  </section>;
}

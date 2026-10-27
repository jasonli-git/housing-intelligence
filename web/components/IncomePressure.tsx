"use client";
import { Gloss } from "@/components/Gloss";
import {useState} from "react";
import type {HousingPressure} from "@/lib/api";
import {LearningExhibit} from "./LearningExhibit";

const LABELS=["Up to 30%","Over 30–50%","Over 50–80%","Over 80–100%","Over 100%"];
const EXPLANATIONS=["at most 30%","over 30% and up to 50%","over 50% and up to 80%","over 80% and up to 100%","over 100%"];
export function IncomePressure({data,concise=false,idPrefix=""}:{data:HousingPressure|null;concise?:boolean;idPrefix?:string}) {
  const [tenure,setTenure]=useState<"renter"|"owner">("renter");
  const [band,setBand]=useState<number|null>(null);
  if(!data)return null;
  const rows=data.bands.filter(row=>row.tenure===tenure).sort((a,b)=>a.band-b.band);
  return <LearningExhibit kind="Income & housing pressure"><section className="income-pressure" aria-labelledby={`${idPrefix}income-pressure-heading`}>
    <h2 id={`${idPrefix}income-pressure-heading`}>{concise ? "Housing cost burden" : "Who feels housing costs most?"}</h2>
    <p>{data.period} · Share of {tenure==="renter"?"renters":"owners"} spending over 30% of income on housing.</p>
    <div className="income-pressure-tabs" role="group" aria-label="Household tenure">{(["renter","owner"] as const).map(value=><button type="button" key={value} aria-pressed={tenure===value} onClick={()=>setTenure(value)}>{value==="renter"?"Renters":"Owners"}</button>)}</div>
    <p className="income-pressure-axis"><Gloss>Income as a share of HUD area median family income</Gloss></p>
    <div className="income-pressure-bars">{rows.map(row=><div key={row.band}><button type="button" className="income-band-label" aria-pressed={band===row.band} aria-controls={`${idPrefix}income-band-explanation`} onClick={()=>setBand(band===row.band?null:row.band)}>{LABELS[row.band]}</button><div className="income-pressure-track" aria-hidden="true"><i style={{width:`${(row.share??0)*100}%`}}/>{row.share!==null&&row.margin!==null&&<b className="income-pressure-margin" style={{left:`${Math.max(0,row.share-row.margin)*100}%`,width:`${(Math.min(1,row.share+row.margin)-Math.max(0,row.share-row.margin))*100}%`}}/>}</div><strong>{row.share===null?"Not available":`${(row.share*100).toFixed(0)}%`}</strong><small>{row.share!==null&&row.margin!==null?`±${(row.margin*100).toFixed(1)} points · `:""}{row.total.toLocaleString("en-US")} households{row.unknown>0?` · ${row.unknown.toLocaleString("en-US")} uncomputed`:""}</small></div>)}</div>
    <p id={`${idPrefix}income-band-explanation`} className="income-band-explanation" aria-live="polite">{band===null?(concise ? "" : "Tap an income band to understand it."):`These households earn ${EXPLANATIONS[band]} of their local HUD family-income benchmark, adjusted for household size.`}</p>
    <p className="sales-note">Survey estimates; whiskers show 90% margins. Bands are not eligibility limits.</p>
<details><summary>Definitions &amp; sources</summary><p>HUD adjusts area median family income for household size. It is not this page’s median household income. Housing costs include utilities. Each share uses all {tenure==="renter"?"renter":"owner"} households in that income band; uncomputed cases remain in the denominator, not counted as unburdened. HUD rounds counts to five households; small groups can have wide margins or no calculable share.</p>{data.basis==="county_sum"&&<p>Statewide view: sum of estimates for all {data.areas} counties, not a separately published state table. Bands use each household’s local HUD area. Margins use the Census aggregation approximation.</p>}<p>A group estimate does not predict your household’s costs.</p><a href={data.source_url} target="_blank" rel="noreferrer">{data.source} ↗</a><p>{data.period} survey · Release {data.releases.map(r=>r.release_id).join(", ")}</p></details>
  </section></LearningExhibit>;
}

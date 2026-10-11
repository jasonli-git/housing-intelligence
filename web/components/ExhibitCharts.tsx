"use client";

import { useId, useState } from "react";
import Link from "next/link";
import type { Migration, PacketMetric, Persistence } from "@/lib/api";
import type { ConstructionYear } from "@/lib/construction";
import { regionPath } from "@/lib/placeRoutes";
import { againstUsual } from "@/lib/persistence";
import { formatValue } from "@/lib/format";

export function PaycheckExhibit({ metrics }: { metrics: PacketMetric[] }) {
  const choices = metrics.filter(m => ["price_to_income", "rent_to_income"].includes(m.metric_id));
  const [chosen, setChosen] = useState(choices[0]?.metric_id);
  const metric = choices.find(m => m.metric_id === chosen) ?? choices[0];
  if (!metric) return null;
  const home = metric.metric_id === "price_to_income";
  const label = (v: number) => home ? `${v.toFixed(2)}×` : `${(v * 100).toFixed(1)}%`;
  const max = Math.max(metric.start_value, metric.end_value, 1e-6);
  return <figure className="exhibit-plot paycheck-exhibit">
    <div className="exhibit-choice" aria-label="Compare costs against income">{choices.map(m => <button key={m.metric_id} type="button" aria-pressed={m.metric_id === metric.metric_id} onClick={()=>setChosen(m.metric_id)}>{m.metric_id === "price_to_income" ? "Home prices" : "Rent"}</button>)}</div>
    <div className="exhibit-pair">{[{value: metric.start_value, date: metric.window_start}, {value: metric.end_value, date: metric.window_end}].map(p => <div key={p.date}><strong>{label(p.value)}</strong><span>{p.date.slice(0,4)}</span><div className="exhibit-track" aria-hidden="true"><i style={{width:`${Math.max(0,p.value)/max*100}%`}} /></div></div>)}</div>
    <figcaption>{home ? "Home price ÷ yearly household income." : "Yearly rent ÷ yearly household income."} Higher means more pressure. Local estimates—not your budget.</figcaption>
  </figure>;
}

export function HistoryExhibit({ data }: { data: Persistence }) {
  const id = useId();
  const [index,setIndex] = useState(Math.max(0,data.series.length-1));
  if (data.withheld || data.series.length < 2) return null;
  const point = data.series[index];
  const max = Math.max(...data.series.map(p=>Math.abs(p.vs_median)),1);
  return <figure className="exhibit-plot history-interactive">
    <div className="exhibit-readout"><strong>{point.year}</strong><span>{againstUsual(point.vs_median)} the usual level</span></div>
    <div className="exhibit-history" aria-hidden="true">{data.series.map((p,i)=><div key={p.year} data-selected={i===index}><i style={{height:`${Math.abs(p.vs_median)/max*45}%`,bottom:p.vs_median>=0?"50%":undefined,top:p.vs_median<0?"50%":undefined}} /></div>)}</div>
    <label htmlFor={id}>Explore a year <input id={id} type="range" min="0" max={data.series.length-1} value={index} aria-valuetext={`${point.year}: ${againstUsual(point.vs_median)} the usual level`} onChange={e=>setIndex(Number(e.target.value))}/></label>
    <figcaption>Above the line: homes cost more against income than usual. “Usual” is the historical median—not a target or forecast. Missing years are omitted.</figcaption>
  </figure>;
}

export function ConstructionExhibit({ rows }: { rows: ConstructionYear[] }) {
  const [year,setYear] = useState(rows[0]?.year);
  const row=rows.find(r=>r.year===year)??rows[0];
  if (!row) return null;
  const max=Math.max(...rows.flatMap(r=>[r.completed??0,r.demolished??0]),1);
  return <figure className="exhibit-plot construction-exhibit">
    <div className="exhibit-choice" aria-label="Construction year">{[...rows].reverse().map(r=><button type="button" key={r.year} aria-pressed={row.year===r.year} onClick={()=>setYear(r.year)}>{r.year}{r.preliminary?"*":""}</button>)}</div>
    <div className="exhibit-pair">{[{label:"Completed",value:row.completed},{label:"Demolished",value:row.demolished}].map(p=><div key={p.label}><strong>{p.value===null?"Not reported":formatValue(p.value,"count")}</strong><span>{p.label}</span><div className="exhibit-track" aria-hidden="true">{p.value!==null&&<i style={{width:`${p.value/max*100}%`}}/>}</div></div>)}</div>
    <figcaption><b>Net added: {row.net===null?"not reported":formatValue(row.net,"count")}</b> = completions − demolitions. Permits aren’t finished homes. {row.preliminary&&"* Preliminary. "}Missing ≠ zero; county totals cover reporting towns.</figcaption>
  </figure>;
}

export function MigrationExhibit({ data }: { data: Migration }) {
  const [direction,setDirection]=useState<"arrivals"|"departures">("arrivals");
  const flows=data[direction];
  const max=Math.max(...data.arrivals.map(f=>f.returns),...data.departures.map(f=>f.returns),1);
  return <figure className="exhibit-plot migration-exhibit">
    <div className="exhibit-choice" aria-label="Migration direction"><button type="button" aria-pressed={direction==="arrivals"} onClick={()=>setDirection("arrivals")}>Where arrivals lived</button><button type="button" aria-pressed={direction==="departures"} onClick={()=>setDirection("departures")}>Where leavers went</button></div>
    <figcaption>{data.county_name} County · {data.flows_year ?? "Year not available"}. Matched tax returns—not all residents. Both directions use the same scale.</figcaption>
    <ol className="exhibit-destinations">{flows.map(f=><li key={`${f.rank}-${f.name}`}><span>{f.region_id===null?f.name:<Link className="destination-county" href={regionPath(f.region_id)}>{f.name}</Link>}</span><strong>{formatValue(f.returns,"count")} <small>returns · {(f.share*100).toFixed(1)}%</small></strong><div className="exhibit-track" aria-hidden="true"><i style={{width:`${f.returns/max*100}%`}} /></div></li>)}</ol>
    {!flows.length&&<p>No published destination rows for this direction. Suppressed flows are not zero.</p>}
  </figure>;
}

export function SaleExhibit({ median, lower, upper, period }: { median:number; lower?:number; upper?:number; period:string }) {
  const values=[{label:"Lower quartile",value:lower},{label:"Median sale",value:median},{label:"Upper quartile",value:upper}].filter((p):p is {label:string;value:number}=>p.value!==undefined);
  const [chosen,setChosen]=useState("Median sale");
  const point=values.find(p=>p.label===chosen)??values[0];
  return <figure className="exhibit-plot sale-exhibit"><div className="exhibit-readout"><strong>{formatValue(point.value,"usd")}</strong><span>{point.label} · {period}</span></div><div className="exhibit-choice" aria-label="Explore the sale-price distribution">{values.map(p=><button type="button" key={p.label} aria-pressed={chosen===p.label} onClick={()=>setChosen(p.label)}>{p.label}</button>)}</div><figcaption>{lower!==undefined&&upper!==undefined?"Quartiles bracket the middle half of qualifying sales. ":"Only the median is available. "}Sold homes—not every home’s value.</figcaption></figure>;
}

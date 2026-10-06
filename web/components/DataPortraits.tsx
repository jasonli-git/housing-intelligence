"use client";

import { useEffect, useRef, useState } from "react";
import type { Observation } from "@/lib/api";
import type { ConstructionYear } from "@/lib/construction";
import { connectedStock, costSlices, type CostSlice } from "@/lib/dataPortraits";
import { formatValue } from "@/lib/format";
import { surveyYears } from "@/lib/periods";

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const margin = (row: Observation) => row.margin_of_error == null ? "Margin not available" : `90% margin: ±${(row.margin_of_error * 100).toFixed(1)} percentage points`;

export function VacancyPortrait({ earlier, latest }: { earlier: Observation; latest: Observation }) {
  const ref = useRef<HTMLElement>(null);
  const manual = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [current, setCurrent] = useState(true);
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches || !ref.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting) || manual.current) return;
      observer.disconnect(); setCurrent(false); timerRef.current = setTimeout(() => setCurrent(true), 1100);
    }, { threshold: .35 });
    observer.observe(ref.current);
    const stop = () => { if (reduced.matches) { clearTimeout(timerRef.current); observer.disconnect(); setCurrent(true); } };
    reduced.addEventListener("change", stop);
    return () => { clearTimeout(timerRef.current); observer.disconnect(); reduced.removeEventListener("change", stop); };
  }, []);
  const choose = (latest: boolean) => { manual.current = true; clearTimeout(timerRef.current); setCurrent(latest); };
  const shown = current ? latest : earlier;
  return <figure ref={ref} className="data-portrait vacancy-portrait">
    <figcaption><span className="quiet-label">Computed data portrait · Census ACS</span><h3>Homes standing empty</h3>
      <p className="portrait-stat">{percent(earlier.value)} <span>→</span> {percent(latest.value)}</p>
      <p>{surveyYears(earlier.period_start, earlier.period_end)} → {surveyYears(latest.period_start, latest.period_end)} survey estimates</p>
    </figcaption>
    <div className="home-mosaic" aria-hidden="true">{Array.from({ length: 100 }, (_, i) => <i key={i} data-empty={i < Math.round(shown.value * 100)} />)}</div>
    <div className="portrait-controls"><button type="button" aria-pressed={!current} onClick={() => choose(false)}>Earlier estimate</button><button type="button" aria-pressed={current} onClick={() => choose(true)}>Latest estimate</button></div>
    <p className="portrait-note">Showing {current ? "latest" : "earlier"}: about {Math.round(shown.value * 100)} of 100 representative homes. Not actual properties or available rentals; includes seasonal and for-sale homes.</p>
    <details><summary>Periods &amp; uncertainty</summary><p>Each estimate pools five years of survey responses. Tiles round to whole homes; exact percentages above do not. {surveyYears(earlier.period_start, earlier.period_end)}: {margin(earlier)}. {surveyYears(latest.period_start, latest.period_end)}: {margin(latest)}. The visual does not establish a statistically significant change.</p></details>
  </figure>;
}

export function StockFlow({ row }: { row: ConstructionYear }) {
  if (!connectedStock(row)) return null;
  const maximum = Math.max(row.completed!, row.demolished!, Math.abs(row.net!), 1);
  return <figure className="data-portrait stock-flow"><figcaption><span className="quiet-label">Reported building activity · NJ DCA</span><h3>How the housing stock moved</h3><p>{row.year}{row.preliminary ? " · preliminary" : ""} · only towns that reported</p></figcaption>
    <div className="stock-equation">{[{label:"Completed",value:row.completed!,kind:"added"},{label:"Demolished",value:row.demolished!,kind:"removed"},{label:"Net change",value:row.net!,kind:"net"}].map((part,i) => <div key={part.kind}>
      <span className="stock-symbol" aria-hidden="true">{i === 0 ? "+" : i === 1 ? "−" : "="}</span><strong>{formatValue(part.value,"count")}</strong><span>{part.label}</span><div className={`stock-band ${part.kind}`} aria-hidden="true" style={{width:`${Math.abs(part.value)/maximum*100}%`}} />
    </div>)}</div><p className="portrait-note">Completed − demolished = net change. These are reported totals, not a count of every construction project. Permits are not completed homes; reporting coverage remains in the details below.</p>
  </figure>;
}

export type CountyPoint = { id: number; name: string; value: number; start: string; end: string; margin: number | null };
export function CountyConstellation({ rows, selected }: { rows: CountyPoint[]; selected: number }) {
  const [active, setActive] = useState(selected);
  const field = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(240);
  useEffect(() => {
    if (!field.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(field.current);
    return () => observer.disconnect();
  }, []);
  const sorted = [...rows].sort((a,b) => a.value-b.value || a.id-b.id);
  const chosen = sorted.find(r => r.id === active) ?? sorted.find(r => r.id === selected);
  if (sorted.length < 2 || !chosen) return null;
  const max = Math.max(...sorted.map(r => r.value), .01);
  const lanes: number[] = [];
  const positions = sorted.map(row => {
    const x = (row.value / max * .9 + .05) * width;
    let lane = lanes.findIndex(last => x - last >= 32);
    if (lane < 0) lane = lanes.length;
    lanes[lane] = x;
    return lane;
  });
  return <figure className="data-portrait county-constellation"><figcaption><span className="quiet-label">One measure · Census ACS</span><h3>Vacancy across New Jersey</h3><p>Select a county to inspect its estimate—not an affordability ranking.</p></figcaption>
    <div className="constellation-axis"><span>0%</span><span>{percent(max)}</span></div>
    <div ref={field} className="constellation-field" style={{height:`${lanes.length*32+20}px`}} role="group" aria-label="County vacancy estimates">{sorted.map((r,i) => <button key={r.id} type="button" className={r.id===selected ? "current-county" : ""} style={{left:`${r.value/max*90+5}%`,top:`${positions[i]*32+8}px`}} aria-label={`${r.name}, ${percent(r.value)} vacant`} aria-pressed={active===r.id} onFocus={() => setActive(r.id)} onMouseEnter={() => setActive(r.id)} onClick={() => setActive(r.id)}><span aria-hidden="true" /></button>)}</div>
    <p className="constellation-detail" aria-live="polite"><strong>{chosen.name} · {percent(chosen.value)}</strong><span>{surveyYears(chosen.start,chosen.end)} · {chosen.margin===null ? "margin unavailable" : `90% margin ±${(chosen.margin*100).toFixed(1)} points`}</span><a href={`/regions/${chosen.id}`}>Explore county →</a></p>
    <p className="portrait-note">{rows.length} of 21 counties with figures. Horizontal position is vacancy share; vertical spacing only prevents overlap. Latest available survey periods are shown per county. Includes seasonal homes—not a map or a ranking of homes available to rent.</p>
  </figure>;
}

export function CostComposition({ parts, principal, missing, optional }: { parts: CostSlice[]; principal: number; missing: string[]; optional: string[] }) {
  const slices = costSlices(parts,principal);
  const total = slices.reduce((sum,p) => sum+p.value,0);
  const [active,setActive] = useState<string | null>(null);
  const selected = slices.find(p => p.key===active);
  let offset = 0;
  return <figure className="cost-composition"><figcaption><h3>Where the first month’s money goes</h3><p>Interest and bills are spent. Principal pays down your loan—not appreciation.</p></figcaption>
    <div className="composition-layout"><svg viewBox="0 0 120 120" className="composition-ring" aria-hidden="true"><circle cx="60" cy="60" r="44" className="composition-track" />{slices.map(p => {
      const length = total>0 ? p.value/total*100 : 0; const start=offset; offset+=length;
      return <circle key={p.key} cx="60" cy="60" r="44" pathLength="100" stroke={p.color} strokeWidth={p.key===active ? 16 : 12} strokeDasharray={`${length} ${100-length}`} strokeDashoffset={-start} transform="rotate(-90 60 60)" />;
    })}<text x="60" y="57" textAnchor="middle">{formatValue(selected?.value ?? total,"usd")}</text><text x="60" y="71" textAnchor="middle" className="composition-caption">{selected ? `${(selected.value/total*100).toFixed(1)}% of included total` : "included each month"}</text></svg>
    <div className="composition-key">{slices.map(p => <button type="button" key={p.key} aria-pressed={active===p.key} onMouseEnter={() => setActive(p.key)} onFocus={() => setActive(p.key)} onClick={() => setActive(p.key)}><i aria-hidden="true" style={{background:p.color}} /><span>{p.label}</span><b>{formatValue(p.value,"usd")}</b></button>)}<button type="button" onClick={() => setActive(null)}>Show included total</button></div></div>
    {selected && <p className="portrait-note" aria-live="polite">{selected.label}: {formatValue(selected.value,"usd")} · {(selected.value/total*100).toFixed(1)}% of the included total.</p>}
    <p className="portrait-note">{missing.length>0 ? `Partial estimate. Missing: ${missing.join(", ")}. ` : ""}{optional.length>0 ? `Add if applicable: ${optional.join(", ")}. ` : ""}Amounts follow the cost card and your inputs; the diagram uses unrounded values, while labels round to dollars.</p>
  </figure>;
}

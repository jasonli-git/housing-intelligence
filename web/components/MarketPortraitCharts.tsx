"use client";

import Link from "next/link";
import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatChange, formatValue } from "@/lib/format";
import { periodLabel } from "@/lib/periods";
import { marketDistribution, marketLine, type MarketCohort, type MarketPoint } from "@/lib/marketPortrait";
import styles from "./PlaceMarketOpening.module.css";

const W = 440;
const money = (value: number) => formatValue(value, "usd");
const shortMoney = (value: number) => value < 10000 ? money(value) : value >= 1e6 ? `$${(value / 1e6).toFixed(1)}M` : `$${Math.round(value / 1000)}k`;
function step(event: KeyboardEvent, current: number, length: number, set: (n: number) => void) {
  const next = event.key === "Home" ? 0 : event.key === "End" ? length - 1
    : ["ArrowRight", "ArrowUp"].includes(event.key) ? Math.min(length - 1, current + 1)
    : ["ArrowLeft", "ArrowDown"].includes(event.key) ? Math.max(0, current - 1) : null;
  if (next !== null) { event.preventDefault(); set(next); }
}
function pointerX(event: PointerEvent<HTMLDivElement>, width=W) {
  const rect = event.currentTarget.getBoundingClientRect();
  return (event.clientX - rect.left) / rect.width * width;
}

export function MarketPeerPlot({ cohort, ownId, value, label, scope, places = "towns" }: { cohort?: MarketCohort; ownId: number; value: number; label: string; scope: string;
  /** What the cohort is, plural: towns, counties or ZIP codes. */
  places?: string }) {
  const points = useMemo(()=>[...(cohort?.points??[])].sort((a,b)=>a.value-b.value||a.id-b.id),[cohort]);
  const distribution = useMemo(()=>marketDistribution(points.map(p=>p.value)),[points]);
  const own = points.findIndex(p => p.id === ownId && Math.abs(p.value - value) < .01);
  const [index, setIndex] = useState(own < 0 ? 0 : own);
  if (!distribution || own < 0) return <p className={styles.annotation}>Same-month comparison unavailable.</p>;
  const selected = points[index] ?? points[own];
  const {min,q1,median,q3,max}=distribution;
  const x = (v: number) => max===min?W/2:18+(v-min)/(max-min)*(W-36);
  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const px = pointerX(e);
    setIndex(points.reduce((best, p, i) => Math.abs(x(p.value) - px) < Math.abs(x(points[best].value) - px) ? i : best, 0));
  };
  return <div className={styles.peerPlot} data-portrait="peers" data-peer-count={points.length}>
    <p className={styles.chartLabel}>Where it sits <span>{points.length} of {cohort!.total} {scope} {places} · {periodLabel(cohort!.period, cohort!.metricId)}</span></p>
    <div className={styles.plotControl} role="slider" tabIndex={0} aria-label={`Explore ${label} across ${scope} ${places}`}
      aria-valuemin={0} aria-valuemax={points.length - 1} aria-valuenow={index} aria-valuetext={`${selected.name}: ${money(selected.value)}`}
      onKeyDown={e => step(e, index, points.length, setIndex)} onPointerMove={e => { if (e.pointerType === "mouse" || e.buttons) pick(e); }}
      onPointerDown={e => { e.currentTarget.focus({ preventScroll: true }); pick(e); }}>
      <svg viewBox={`0 0 ${W} 75`} aria-hidden="true" data-distribution="box-range">
        <line x1={x(min)} x2={x(max)} y1="34" y2="34" className={styles.rangeLine} />
        {[min,max].map((v,i)=><line key={i} x1={x(v)} x2={x(v)} y1="27" y2="41" className={styles.rangeLine}/>)}
        <rect x={x(q1)} y="23" width={x(q3)-x(q1)} height="22" rx="3" className={styles.distributionBox}/>
        <line x1={x(median)} x2={x(median)} y1="22" y2="46" className={styles.medianLine}/>
        <line x1={x(value)} x2={x(value)} y1="16" y2="52" className={styles.ownLine}/>
        <path d={`M${x(value)-4},7H${x(value)+4}L${x(value)},13Z`} className={styles.ownMarker}/>
        <text x={x(value)+(x(value)>W/2?-7:7)} y="14" textAnchor={x(value)>W/2?"end":"start"} className={styles.ownLabel}>{points[own].name}</text>
        {index!==own&&<line x1={x(selected.value)} x2={x(selected.value)} y1="19" y2="49" className={styles.selectedLine}/>}
        {min===max?<text x={W/2} y="69" textAnchor="middle" className={styles.axisText}>{money(min)}</text>:<><text x="18" y="69" className={styles.axisText}>{money(min)}</text><text x={W-18} y="69" textAnchor="end" className={styles.axisText}>{money(max)}</text></>}
      </svg>
    </div>
    <p className={styles.distributionNote}>Middle 50%: {shortMoney(q1)}–{shortMoney(q3)} · median {shortMoney(median)}</p>
    <span className="visually-hidden">Observed range across {places}, {money(min)} to {money(max)}; lower quartile {money(q1)}, median {money(median)}, upper quartile {money(q3)}. These are area benchmarks, not individual homes.</span>
    <div className={styles.peerReading} aria-live="polite" aria-atomic="true"><span>{selected.name} <b>{money(selected.value)}</b></span>
      {index !== own ? <Link href={`/compare?places=${ownId},${selected.id}`}>Compare <span aria-hidden="true">↗</span></Link> : <span className={styles.annotation}>Highlighted</span>}
    </div>
    <noscript><p>Interactive selection requires JavaScript. The marker and headline show this place; the box shows the middle half of measured {places}.</p></noscript>
  </div>;
}

export function MarketTrend({ points, label, change }: { points: MarketPoint[]; label: string; change?: number }) {
  const [index, setIndex] = useState(Math.max(0, points.length - 1));
  if (points.length < 2) return <p className={styles.annotation}>Comparable history unavailable.</p>;
  const start = points[0], end = points.at(-1)!, selected = points[index] ?? end;
  const low = Math.min(...points.map(p => p.value)), high = Math.max(...points.map(p => p.value));
  const x = (date: string) => 8 + (Date.parse(date) - Date.parse(start.date)) / (Date.parse(end.date) - Date.parse(start.date) || 1) * 144;
  const y = (value: number) => high===low?24:8+(high-value)/(high-low)*32;
  const pick = (e: PointerEvent<HTMLDivElement>) => { const px = pointerX(e,160); setIndex(points.reduce((best, p, i) => Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px) ? i : best, 0)); };
  return <div className={styles.trend} data-portrait="trend">
    <p className={styles.sparkChange}><span className="visually-hidden">How it moved </span>{change !== undefined && <b>{formatChange(change)}</b>}</p>
    <div className={styles.plotControl} role="slider" tabIndex={0} aria-label={`Explore ${label} history`}
      aria-valuemin={0} aria-valuemax={points.length - 1} aria-valuenow={index} aria-valuetext={`${periodLabel(selected.date, "zori_all")}: ${money(selected.value)}`}
      onKeyDown={e => step(e, index, points.length, setIndex)} onPointerMove={e => { if (e.pointerType === "mouse" || e.buttons) pick(e); }}
      onPointerDown={e => { e.currentTarget.focus({ preventScroll: true }); pick(e); }}>
      <svg viewBox="0 0 160 48" preserveAspectRatio="none" aria-hidden="true">
        <line x1="8" x2="152" y1="40" y2="40" className={styles.axis}/>
        <path d={marketLine(points, x, y)} className={styles.trendLine} />
        <line x1={x(selected.date)} x2={x(selected.date)} y1="4" y2="44" className={styles.cursor} />
        <circle cx={x(selected.date)} cy={y(selected.value)} r="4" className={styles.ownDot} />
      </svg>
    </div>
    <div className={styles.trendDates} title={`${periodLabel(start.date,"zori_all")}–${periodLabel(end.date,"zori_all")}`}><span>{start.date.slice(0,4)}</span><span>{end.date.slice(0,4)}</span></div>
    <span className="visually-hidden">Trend from {periodLabel(start.date,"zori_all")} to {periodLabel(end.date,"zori_all")}; {money(low)} to {money(high)}. Each chart uses its own vertical scale.</span>
    <output className={styles.trendReading} aria-live="polite">{periodLabel(selected.date, "zori_all")} <b>{money(selected.value)}</b></output>
  </div>;
}

"use client";

import Link from "next/link";
import {useEffect,useId,useRef,useState} from "react";
import type {PacketLevel} from "@/lib/api";
import {comparisonMeasures} from "@/lib/placeComparisons";
import {formatMetric} from "@/lib/format";
import {firstEnd,ordinal} from "@/lib/ranks";
import {periodLabel,surveyYears} from "@/lib/periods";
import {marginLabel,type Uncertainties} from "@/lib/uncertainty";
import styles from "./PlaceComparisons.module.css";
import railStyles from "./PlaceStories.module.css";
import {UpdatedMark} from "./UpdatedMark";

export function PlaceComparisonRail({name,peers,levels,uncertainties,reportHref,revisions,measures}:{name:string;peers:string;levels:PacketLevel[];uncertainties:Uncertainties;reportHref:string;revisions?:Map<string,{from:string;on:string}>;
  /** Which measures to rank; the curated five when absent. */
  measures?:readonly string[]}){
  const items=comparisonMeasures(levels,uncertainties,measures);
  const track=useRef<HTMLUListElement>(null),trackId=useId();
  const [edges,setEdges]=useState({start:true,end:false});
  useEffect(()=>{
    const el=track.current;if(!el)return;
    const measure=()=>setEdges({start:el.scrollLeft<=4,end:el.scrollLeft+el.clientWidth>=el.scrollWidth-4});
    measure();el.addEventListener("scroll",measure,{passive:true});
    const observer=new ResizeObserver(measure);observer.observe(el);
    return ()=>{el.removeEventListener("scroll",measure);observer.disconnect();};
  },[items.length]);
  const move=(direction:number)=>{
    const el=track.current;if(!el)return;
    el.scrollBy({left:direction*el.clientWidth*.85,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
  };
  if(!items.length)return null;
  return <section className={styles.comparisons} aria-labelledby="place-comparisons-heading">
    <header><h3 id="place-comparisons-heading">Ranked measures</h3><Link href={`${reportHref}#report-current`}>All measures →</Link></header>
    <p className={styles.note}>{measures?`Where ${name} ranks among the highest or lowest ${peers} (the outer 5%, or three at either end). `:""}Current-value rank among {peers} · lower → higher. This is a rank scale, not a value scale; bands include ties and 90% survey rank ranges.</p>
    <div className={railStyles.rail}>
    <button type="button" className={`${railStyles.railArrow} ${railStyles.previous}`} aria-label="Previous ranked measures" aria-controls={trackId} disabled={edges.start} onClick={()=>move(-1)}>‹</button>
    <ul ref={track} id={trackId} className={styles.rail} tabIndex={0} aria-label={`Current-value comparisons for ${name}`} onKeyDown={event=>{
      if(!["ArrowRight","ArrowLeft","Home","End"].includes(event.key))return;
      const links=Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>("a[data-comparison-measure]"));
      const index=links.indexOf(document.activeElement as HTMLAnchorElement);if(index<0)return;
      event.preventDefault();
      const next=event.key==="Home"?0:event.key==="End"?links.length-1:Math.max(0,Math.min(links.length-1,index+(event.key==="ArrowRight"?1:-1)));
      links[next]?.focus();
      if(event.key==="Home"||event.key==="End") event.currentTarget.scrollTo({left:event.key==="Home"?0:event.currentTarget.scrollWidth-event.currentTarget.clientWidth,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
    }}>
      {items.map(({row,label,best,worst,position,low,high,margin,rangeMissing})=><li key={row.metric_id}>
        <div className={styles.tile} data-comparison-card={row.metric_id}>
        <Link href={`${reportHref}#report-current`} className={styles.measureLink} data-comparison-measure>
          <span className={styles.label}>{label}</span>
          <span className={styles.value}>{formatMetric(row.value,row.unit,row.metric_id)} <small>{marginLabel(row.value,margin,row.unit,row.metric_id)}</small></span>
          <span className={styles.rank}>{ordinal(best)}{worst!==best?`–${ordinal(worst)}`:""} of {row.of} · {firstEnd("value",row.direction)}</span>
          <span className={styles.position} role="img" aria-label={`Current-value rank ${row.rank} of ${row.of}, ${firstEnd("value",row.direction)}; rank span ${best} to ${worst}. Ordered peer positions, not a linear value scale.`} title={`Point rank: ${ordinal(row.rank!)} of ${row.of}; rank span ${ordinal(best)}–${ordinal(worst)}`}><i style={{left:`${low*100}%`,width:`${(high-low)*100}%`}}/><b style={{left:`${position*100}%`}}/></span>
          <span className={styles.period}>{row.metric_id.startsWith("modiv_")?`NJ property records · ${periodLabel(row.period_end,row.metric_id)}`:row.survey===false?periodLabel(row.period_end,row.metric_id):`ACS ${surveyYears(row.period_start,row.period_end)}`}{rangeMissing?" · rank range unavailable":""}</span>
        </Link>
        {revisions?.get(row.metric_id)&&<div className={styles.revision}><UpdatedMark updated={revisions.get(row.metric_id)!}/></div>}
        </div>
      </li>)}
    </ul>
    <button type="button" className={`${railStyles.railArrow} ${railStyles.nextArrow}`} aria-label="Next ranked measures" aria-controls={trackId} disabled={edges.end} onClick={()=>move(1)}>›</button>
    </div>
  </section>;
}

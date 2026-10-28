"use client";

import Link from "next/link";
import {useEffect,useId,useRef,useState} from "react";
import type {PacketLevel} from "@/lib/api";
import {comparisonMeasures} from "@/lib/placeComparisons";
import {formatMetric} from "@/lib/format";
import {firstEnd,ordinal} from "@/lib/ranks";
import {surveyYears} from "@/lib/periods";
import {marginLabel,type Uncertainties} from "@/lib/uncertainty";
import styles from "./PlaceComparisons.module.css";
import railStyles from "./PlaceStories.module.css";

export function PlaceComparisonRail({name,peers,levels,uncertainties,reportHref}:{name:string;peers:string;levels:PacketLevel[];uncertainties:Uncertainties;reportHref:string}){
  const items=comparisonMeasures(levels,uncertainties);
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
    <header><h3 id="place-comparisons-heading">How it compares</h3><Link href={`${reportHref}#report-current`}>All measures →</Link></header>
    <p className={styles.note}>Current values · {peers}. Lower → higher values; bands include ties and 90% survey rank ranges.</p>
    <div className={railStyles.rail}>
    <button type="button" className={`${railStyles.railArrow} ${railStyles.previous}`} aria-label="Previous ranked measures" aria-controls={trackId} disabled={edges.start} onClick={()=>move(-1)}>‹</button>
    <ul ref={track} id={trackId} className={styles.rail} tabIndex={0} aria-label={`Current-value comparisons for ${name}`} onKeyDown={event=>{
      if(!["ArrowRight","ArrowLeft","Home","End"].includes(event.key))return;
      const links=Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>("a"));
      const index=links.indexOf(document.activeElement as HTMLAnchorElement);if(index<0)return;
      event.preventDefault();
      const next=event.key==="Home"?0:event.key==="End"?links.length-1:Math.max(0,Math.min(links.length-1,index+(event.key==="ArrowRight"?1:-1)));
      links[next]?.focus();
    }}>
      {items.map(({row,label,best,worst,position,low,high,margin,rangeMissing})=><li key={row.metric_id}>
        <Link href={`${reportHref}#report-current`} className={styles.tile}>
          <span className={styles.label}>{label}</span>
          <span className={styles.value}>{formatMetric(row.value,row.unit,row.metric_id)} <small>{marginLabel(row.value,margin,row.unit,row.metric_id)}</small></span>
          <span className={styles.rank}>{ordinal(best)}{worst!==best?`–${ordinal(worst)}`:""} of {row.of} · {firstEnd("value",row.direction)}</span>
          <span className={styles.position} aria-hidden="true"><i style={{left:`${low*100}%`,width:`${(high-low)*100}%`}}/><b style={{left:`${position*100}%`}}/></span>
          <span className={styles.period}>ACS {surveyYears(row.period_start,row.period_end)}{rangeMissing?" · rank range unavailable":""}</span>
        </Link>
      </li>)}
    </ul>
    <button type="button" className={`${railStyles.railArrow} ${railStyles.nextArrow}`} aria-label="Next ranked measures" aria-controls={trackId} disabled={edges.end} onClick={()=>move(1)}>›</button>
    </div>
  </section>;
}

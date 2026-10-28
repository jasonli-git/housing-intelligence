"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PLACE_STORIES, placeStoryHref, placeStoryName, summarizePlaceStory, type PlaceStoryRecord } from "@/lib/placeStories";
import { PlaceStoryChart } from "./PlaceStoryChart";
import { placeStoryPreviewNote } from "@/lib/marketPlaceStories";
import { livingPreviewNote } from "@/lib/livingPlaceStories";
import styles from "./PlaceStories.module.css";

function PreviewImage({ src, className }: { src: string; className: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? null : <img className={className} src={src} alt="" loading="lazy" decoding="async" width="800" height="500" onError={() => setFailed(true)} />;
}
export function PlaceStoryGallery({ records, artifactUrl }: { records: PlaceStoryRecord[]; artifactUrl: string }) {
  const name = records[0] ? placeStoryName(records[0]) : "this place";
  const track=useRef<HTMLDivElement>(null);
  const [edges,setEdges]=useState({start:true,end:false});
  useEffect(()=>{
    const el=track.current;
    if(!el)return;
    const measure=()=>setEdges({start:el.scrollLeft<=4,end:el.scrollLeft+el.clientWidth>=el.scrollWidth-4});
    measure();el.addEventListener("scroll",measure,{passive:true});
    const observer=new ResizeObserver(measure);observer.observe(el);
    return ()=>{el.removeEventListener("scroll",measure);observer.disconnect();};
  },[records.length]);
  const move=(direction:number)=>{
    const el=track.current;if(!el)return;
    el.scrollBy({left:direction*el.clientWidth*.85,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
  };
  return <section className={styles.gallery} id="place-story-gallery" aria-labelledby="place-story-gallery-heading">
    <h2 id="place-story-gallery-heading">Explore {name} through the data</h2>
    <span id="field-notes" className={styles.legacyAnchor} role="group" aria-label="Market story previews" />
    <span id="more-market-evidence" className={styles.legacyAnchor} role="group" aria-label="More market stories" />
    <span id="local-price-history" className={styles.legacyAnchor} role="group" aria-label="Prices and paychecks story preview" /><span id="trends-exhibits" className={styles.legacyAnchor} role="group" aria-label="Housing trends story preview" />
    <div className={styles.rail}>
    <button type="button" className={`${styles.railArrow} ${styles.previous}`} aria-label="Previous local stories" aria-controls="local-stories-track" disabled={edges.start} onClick={()=>move(-1)}>‹</button>
    <div ref={track} id="local-stories-track" className={styles.cards} role="region" aria-label={`Local stories about ${name}`} tabIndex={0} onKeyDown={event=>{
      if(!["ArrowRight","ArrowLeft","Home","End"].includes(event.key))return;
      const links=Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>("a[data-preview-topic]"));
      const index=links.indexOf(document.activeElement as HTMLAnchorElement);if(index<0)return;
      event.preventDefault();
      const next=event.key==="Home"?0:event.key==="End"?links.length-1:Math.max(0,Math.min(links.length-1,index+(event.key==="ArrowRight"?1:-1)));
      links[next]?.focus();
    }}>{records.map(record => {
      const summary = summarizePlaceStory(record);
      const prefix = `${artifactUrl}/screenshots/place-stories/${record.place.region_id}-${record.topic}-${record.snapshot}`;
      return <Link key={record.topic} id={record.topic === "commute" ? "about-getting-around" : record.topic === "utilities" ? "local-property-evidence" : `story-${record.topic}-preview`} className={styles.card} href={placeStoryHref(record.topic, record.place.region_id)} prefetch={false} data-preview-topic={record.topic} data-preview-snapshot={record.snapshot}>
        <div className={styles.cover} aria-hidden="true"><PlaceStoryChart record={record} /><PreviewImage key={`${prefix}-light`} className={styles.light} src={`${prefix}-light.jpg`} /><PreviewImage key={`${prefix}-dark`} className={styles.dark} src={`${prefix}-dark.jpg`} /></div>
        <p className={styles.topic}><span className={styles.topicName}>{PLACE_STORIES[record.topic].title}</span><span className={styles.openArrow} aria-hidden="true">↗</span></p>
        <h3 id={({ water: "ground-water-heading", commute: "getting-around-heading", sales: "sales-heading", lending: "state-loans-exhibit", building: "homes-added-heading", migration: "who-is-moving-heading", pressure: "income-pressure-heading",sites:"ground-sites-heading",flood:"flood-risk-heading",utilities:"utilities-heading",broadband:"community-broadband-heading" } as Partial<Record<string,string>>)[record.topic]}>{summary.headline}</h3>
        <p className={styles.qualifier}>{livingPreviewNote(record) ?? placeStoryPreviewNote(record)}</p>
        <div className={styles.previewMeta}>
          <p>{summary.source} · {summary.period}</p>
        </div>
      </Link>;
    })}</div>
    <button type="button" className={`${styles.railArrow} ${styles.nextArrow}`} aria-label="Next local stories" aria-controls="local-stories-track" disabled={edges.end} onClick={()=>move(1)}>›</button>
    </div>
    <p className={styles.safety}>Checking a particular home? <a href="https://www9.state.nj.us/DEP_WaterWatch_public/" target="_blank" rel="noreferrer">Check the supplier’s current water records ↗</a>. System records do not describe a private well.</p>
  </section>;
}

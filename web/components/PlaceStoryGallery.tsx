"use client";

import Link from "next/link";
import { useState } from "react";
import { PLACE_STORIES, placeStoryHref, placeStoryName, summarizePlaceStory, type PlaceStoryRecord } from "@/lib/placeStories";
import { PlaceStoryChart } from "./PlaceStoryChart";
import styles from "./PlaceStories.module.css";

function PreviewImage({ src, className }: { src: string; className: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? null : <img className={className} src={src} alt="" loading="lazy" decoding="async" width="800" height="500" onError={() => setFailed(true)} />;
}
export function PlaceStoryGallery({ records, artifactUrl }: { records: PlaceStoryRecord[]; artifactUrl: string }) {
  const name = records[0] ? placeStoryName(records[0]) : "this place";
  return <section className={styles.gallery} id="place-story-gallery" aria-labelledby="place-story-gallery-heading">
    <h2 id="place-story-gallery-heading">Explore {name} through the data</h2>
    <span id="local-price-history" className={styles.legacyAnchor} role="group" aria-label="Prices and paychecks story preview" /><span id="trends-exhibits" className={styles.legacyAnchor} role="group" aria-label="Housing trends story preview" />
    <div className={styles.cards}>{records.map(record => {
      const summary = summarizePlaceStory(record);
      const prefix = `${artifactUrl}/screenshots/place-stories/${record.place.region_id}-${record.topic}-${record.snapshot}`;
      return <Link key={record.topic} id={record.topic === "commute" ? "about-getting-around" : `story-${record.topic}-preview`} className={styles.card} href={placeStoryHref(record.topic, record.place.region_id)} prefetch={false} data-preview-topic={record.topic} data-preview-snapshot={record.snapshot}>
        <div className={styles.cover} aria-hidden="true"><PlaceStoryChart record={record} /><PreviewImage key={`${prefix}-light`} className={styles.light} src={`${prefix}-light.jpg`} /><PreviewImage key={`${prefix}-dark`} className={styles.dark} src={`${prefix}-dark.jpg`} /></div>
        <p className={styles.topic}>{PLACE_STORIES[record.topic].title}<span aria-hidden="true">↗</span></p>
        <h3 id={record.topic === "water" ? "ground-water-heading" : record.topic === "commute" ? "getting-around-heading" : undefined}>{summary.headline}</h3>
        <p className={styles.qualifier}>{record.topic === "water" ? "System history—not today’s tap water." : record.topic === "commute" ? "One-way mean—not your route." : "Survey values—not current asking prices."}</p>
        <div className={styles.previewMeta}>
          <p>{summary.source} · {summary.period}</p>
        </div>
      </Link>;
    })}</div>
    <p className={styles.safety}>Checking a particular home? <a href="https://www9.state.nj.us/DEP_WaterWatch_public/" target="_blank" rel="noreferrer">Check the supplier’s current water records ↗</a>. System records do not describe a private well.</p>
  </section>;
}

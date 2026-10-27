import { placeStoryName, summarizePlaceStory, type PlaceStoryRecord } from "@/lib/placeStories";
import styles from "./PlaceStories.module.css";

/** This exact selected-view graphic is used for both the destination and its capture. */
export function PlaceStoryChart({ record }: { record: PlaceStoryRecord }) {
  const summary = summarizePlaceStory(record);
  const max = Math.max(1, ...summary.rows.map(r => r.value));
  return <figure className={styles.chart} data-place-story-shot data-place-story-id={record.place.region_id} data-place-story-snapshot={record.snapshot} data-topic={record.topic}>
    <figcaption><span className={styles.kicker}>{placeStoryName(record)} · {summary.source} {summary.period}</span><strong>{summary.headline}</strong></figcaption>
    {summary.available && <div className={styles.bars} role="img" aria-label={summary.rows.map(r => `${r.label}: ${r.formatted}${r.margin ? `, ${r.margin}` : ""}${r.aside ? `, ${r.aside}` : ""}`).join("; ")}>
      {summary.rows.map((r, i) => <div className={styles.row} key={`${r.label}-${i}`}><span>{r.label}</span><b>{r.formatted}</b><i aria-hidden="true"><span style={{ width: `${r.value / max * 100}%` }} /></i>{(r.margin || r.aside) && <small>{r.aside ?? `90% margin: ${r.margin}`}</small>}</div>)}
    </div>}
    <p>{summary.qualifier}</p>
  </figure>;
}

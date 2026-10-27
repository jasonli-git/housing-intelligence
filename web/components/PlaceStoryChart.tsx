import { placeStoryName, summarizePlaceStory, type PlaceStoryRecord } from "@/lib/placeStories";
import styles from "./PlaceStories.module.css";
import { againstUsual } from "@/lib/persistence";

/** This exact selected-view graphic is used for both the destination and its capture. */
export function PlaceStoryChart({ record }: { record: PlaceStoryRecord }) {
  const summary = summarizePlaceStory(record);
  const max = Math.max(1, ...summary.rows.map(r => r.value));
  const past = record.topic === "past" && summary.available ? record.countyHistory?.data : null;
  const span = Math.max(1, ...(past?.series.map(p => Math.abs(p.vs_median)) ?? []));
  const yearSpan = past ? Math.max(1, past.last_year-past.first_year+1) : 1;
  return <figure className={styles.chart} data-place-story-shot data-place-story-id={record.place.region_id} data-place-story-snapshot={record.snapshot} data-topic={record.topic}>
    <figcaption><span className={styles.kicker}>{record.topic === "past" ? record.countyHistory?.name ?? "County history" : placeStoryName(record)} · {summary.source} {summary.period}</span><strong>{summary.headline}</strong></figcaption>
    {past && <div className={styles.historyPlot}><svg viewBox="0 0 800 185" role="img" aria-label={`${record.countyHistory?.name}: annual price-to-income distance from its historical median, ${past.first_year} to ${past.last_year}; missing years left blank.`}>
      <line x1="24" x2="776" y1="80" y2="80" />
      {past.series.map(point => {
        const height = Math.abs(point.vs_median)/span*62;
        return <rect key={point.year} x={24+(point.year-past.first_year)/yearSpan*752} y={point.vs_median>=0 ? 80-height : 80} width={Math.max(1,752/yearSpan-3)} height={Math.max(.8,height)} opacity={point.year===past.last_year ? 1 : .55}><title>{`${point.year}: ${againstUsual(point.vs_median)} its usual level`}</title></rect>;
      })}
      <text x="24" y="174">{past.first_year}</text><text x="776" y="174" textAnchor="end">{past.last_year}</text><text x="24" y="13">% from the historical median · zero line = usual</text>
    </svg></div>}
    {summary.available && summary.rows.length > 0 && <div className={styles.bars} role="img" aria-label={summary.rows.map(r => `${r.label}: ${r.formatted}${r.margin ? `, ${r.margin}` : ""}${r.aside ? `, ${r.aside}` : ""}`).join("; ")}>
      {summary.rows.map((r, i) => <div className={styles.row} key={`${r.label}-${i}`}><span>{r.label}</span><b>{r.formatted}</b><i aria-hidden="true"><span style={{ width: `${r.value / max * 100}%` }} /></i>{(r.margin || r.aside) && <small>{r.aside ?? `90% margin: ${r.margin}`}</small>}</div>)}
    </div>}
    <p>{summary.qualifier}</p>
  </figure>;
}

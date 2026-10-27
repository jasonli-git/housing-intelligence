import Link from "next/link";
import { HistoryExhibit } from "./ExhibitCharts";
import { placeStoryHref, placeStoryName, summarizePlaceStory, type PlaceStoryRecord } from "@/lib/placeStories";
import { againstUsual } from "@/lib/persistence";
import styles from "./PlaceStories.module.css";

/** The same interactive graph used in the selected visual story, shown inline. */
export function CountyHistoryContext({ record }: { record: PlaceStoryRecord }) {
  if (record.topic !== "past") return null;
  const summary = summarizePlaceStory(record), county = record.countyHistory, data = county?.data;
  return <section id="county-market-history" className={styles.countyHistory} aria-labelledby="county-market-history-heading" data-county-history-id={county?.region_id} data-history-snapshot={record.snapshot}>
    <header>
      <p className={styles.contextLabel}>County context for {placeStoryName(record)}</p>
      <h3 id="county-market-history-heading">{county ? `${county.name}’s market history` : "County market history"}</h3>
      <p>FHFA / Census SAIPE{data && ` · ${data.first_year}–${data.last_year}`}</p>
      <p>County figures—not a town-level comparison.</p>
      <Link href={placeStoryHref("past", record.place.region_id)}>Explore the full history <span aria-hidden="true">↗</span></Link>
    </header>
    <div className={styles.contextGraph}>
      {summary.available && data ? <>
        <HistoryExhibit data={data} />
        {data.vs_median_low !== null && data.vs_median_high !== null && <p className={styles.contextUncertainty}>{data.last_year} estimate: {againstUsual(data.vs_median_low)} to {againstUsual(data.vs_median_high)} usual, allowing for income uncertainty.</p>}
      </> : <p role="status">{summary.qualifier}</p>}
    </div>
  </section>;
}

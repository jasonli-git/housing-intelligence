import Link from "next/link";
import type { PacketLevel, PacketMetric } from "@/lib/api";
import { formatChange, formatMetric } from "@/lib/format";
import { homePrice } from "@/lib/homePrice";
import { periodLabel, surveyYears, windowLabel } from "@/lib/periods";
import { cohortLabel, marginLabel, rankReading, type Uncertainties } from "@/lib/uncertainty";
import { UpdatedMark } from "./UpdatedMark";
import styles from "./PlaceMarketOpening.module.css";

type Props = {
  levels: PacketLevel[];
  metrics: PacketMetric[];
  uncertainties: Uncertainties;
  peers: { count: number; noun: string; scope: string };
  headline: string | null;
  guideHref: string;
  reportHref: string;
  revisions?: Map<string, { from: string; on: string }>;
};

/** Local hierarchy prototype: facts first, costs next. No new calculations or data. */
export function PlaceMarketOpening({ levels, metrics, uncertainties, peers, headline, guideHref, reportHref, revisions }: Props) {
  const price = homePrice(levels);
  const home = price ? levels.find(l => l.metric_id === (price.basis === "index" ? "zhvi_sfr" : "sr1a_median_sale_price")) : undefined;
  const rent = levels.find(l => l.metric_id === "zori_all");
  const occupied = levels.find(l => l.metric_id === "acs_homeownership_rate");

  function finding(row: PacketLevel | undefined, label: string, missing: string, definition: string) {
    const change = row && metrics.find(m => m.metric_id === row.metric_id && m.window_end === row.period_end);
    const rank = row?.rank != null && row.of != null
      ? rankReading(row.rank, row.of, uncertainties.value.get(row.metric_id), cohortLabel(row.of, peers)) : null;
    return <article className={styles.finding} data-market-metric={row?.metric_id}>
      <h3>{label}</h3>
      {row ? <>
        <p className={styles.figure}>{formatMetric(row.value, row.unit === "usd_month" ? "usd" : row.unit, row.metric_id)}{row.unit === "usd_month" && <span> / month</span>}</p>
        <p className={styles.date}>{row.metric_id.startsWith("z") ? "Zillow" : "Recorded sales"} · {row.metric_id === "sr1a_median_sale_price" ? windowLabel(row.period_start, row.period_end, row.metric_id) : periodLabel(row.period_end, row.metric_id)}</p>
        <p className={styles.definition}>{definition}</p>
        {rank && <p className={styles.comparison}><b>{rank.lead}</b>{rank.range && <small>{rank.range}</small>}</p>}
        {change && <p className={styles.change}><b>{formatChange(change.pct_change)}</b> over five years <span>{windowLabel(change.window_start, change.window_end, change.metric_id)}</span></p>}
        {revisions?.get(row.metric_id) && <UpdatedMark updated={revisions.get(row.metric_id)!} />}
      </> : <p className={styles.definition}>{missing}</p>}
    </article>;
  }

  return <section className={styles.opening} id="place-market" aria-labelledby="place-market-heading">
    <div className={styles.heading}><h2 id="place-market-heading">The housing market</h2><Link href={`${reportHref}#report-measures`}>Figures & sources <span aria-hidden="true">↗</span></Link></div>
    {headline && <p className={styles.lead}>{headline}</p>}
    <div className={styles.findings}>
      {finding(home, price?.basis === "transactions" ? "Median recorded sale price" : "Typical home value", "No current home-value index or recent qualifying sale-price median is available.", price?.basis === "transactions" ? "The middle price of qualifying sales in this window—not the value of every home." : "A modeled value for houses and condos—not a sale price or an appraisal.")}
      {finding(rent, "Typical market rent", "No current market-rent index is available. Survey rents remain in the full report; they are not asking rents.", "A market-rent index—not what every existing tenant pays. Utilities are separate.")}
    </div>
    <p className={styles.rankNote}>Ranks run highest to lowest among {peers.scope}’s {peers.noun} with data—not a nearby-place comparison.</p>
    {occupied && <p className={styles.stock}><b>{formatMetric(occupied.value, occupied.unit, occupied.metric_id)}</b> of occupied homes are owner-occupied. <span>Census ACS · {surveyYears(occupied.period_start, occupied.period_end)} · 90% margin: {marginLabel(occupied.value, uncertainties.value.get(occupied.metric_id)?.margin ?? null, occupied.unit, occupied.metric_id)}</span></p>}
    <nav className={styles.next} aria-label="From the market to your budget"><a href="#quiet-cost">What would it cost per month? <span aria-hidden="true">↓</span></a><Link href={guideHref}>Explore your buying plans <span aria-hidden="true">↗</span></Link></nav>
  </section>;
}

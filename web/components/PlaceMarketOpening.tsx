import Link from "next/link";
import type { Observation, PacketLevel, PacketMetric } from "@/lib/api";
import { formatMetric } from "@/lib/format";
import { homePrice } from "@/lib/homePrice";
import { periodLabel, surveyYears, windowLabel } from "@/lib/periods";
import { marginLabel, type Uncertainties } from "@/lib/uncertainty";
import { marketHistory, type MarketCohort } from "@/lib/marketPortrait";
import { MarketPeerPlot, MarketTrend } from "./MarketPortraitCharts";
import { UpdatedMark } from "./UpdatedMark";
import styles from "./PlaceMarketOpening.module.css";

type Props = {
  levels: PacketLevel[];
  metrics: PacketMetric[];
  uncertainties: Uncertainties;
  peers: { count: number; noun: string; scope: string };
  ownId: number;
  cohorts: MarketCohort[];
  histories: { metricId: string; observations: Observation[] }[];
  reportHref: string;
  revisions?: Map<string, { from: string; on: string }>;
  /** The page's ranked sentences ("79th most expensive of 388…"): the ranks the charts do not show. */
  standing?: string[];
  /** Its short headline, "The 79th most expensive of 388, rising at about the typical pace". */
  standingTitle?: string | null;
};

/** Visual evidence replaces the paragraph/rank/change stack; Princeton only for now. */
export function PlaceMarketOpening({ levels, metrics, uncertainties, peers, ownId, cohorts, histories, reportHref, revisions, standing = [], standingTitle = null }: Props) {
  const places = peers.noun === "counties" ? "counties" : /ZIP/i.test(peers.noun) ? "ZIP codes" : "towns";
  const price = homePrice(levels);
  const home = price ? levels.find(l => l.metric_id === (price.basis === "index" ? "zhvi_sfr" : "sr1a_median_sale_price")) : undefined;
  const rent = levels.find(l => l.metric_id === "zori_all");
  const occupied = levels.find(l => l.metric_id === "acs_homeownership_rate");

  function finding(row: PacketLevel | undefined, label: string, missing: string, definition: string) {
    const change = row && metrics.find(m => m.metric_id === row.metric_id && m.window_end === row.period_end);
    const history = row ? marketHistory(row, histories.find(s => s.metricId === row.metric_id)?.observations ?? [], change) : [];
    const growth = change && row && history[0]?.date === change.window_start && Math.abs(history[0].value - change.start_value) < .01 && Math.abs(change.end_value - row.value) < .01 ? change.pct_change : undefined;
    return <article className={styles.finding} data-market-metric={row?.metric_id}>
      <h3>{label}</h3>
      {row ? <>
        <div className={styles.valueAndTrend}>
          <p className={styles.figure}>{formatMetric(row.value, row.unit === "usd_month" ? "usd" : row.unit, row.metric_id)}{row.unit === "usd_month" && <span> / month</span>}</p>
          <MarketTrend points={history} label={label.toLowerCase()} change={growth} />
        </div>
        <p className={styles.date}>{row.metric_id.startsWith("z") ? "Zillow" : "Recorded sales"} · {row.metric_id === "sr1a_median_sale_price" ? windowLabel(row.period_start, row.period_end, row.metric_id) : periodLabel(row.period_end, row.metric_id)}</p>
        <p className={styles.definition}>{definition}</p>
        <MarketPeerPlot cohort={cohorts.find(c => c.metricId === row.metric_id && c.period === row.period_start)} ownId={ownId} value={row.value} label={label.toLowerCase()} scope={peers.scope === "New Jersey" ? "NJ" : peers.scope} places={places} />
        {revisions?.get(row.metric_id) && <UpdatedMark updated={revisions.get(row.metric_id)!} />}
      </> : <p className={styles.definition}>{missing}</p>}
    </article>;
  }

  return <section className={styles.opening} id="place-market" aria-labelledby="place-market-heading">
    <div className={styles.heading}><h2 id="place-market-heading">The housing market</h2><Link href={`${reportHref}#report-measures`}>Figures & sources <span aria-hidden="true">↗</span></Link></div>
    {standing.length > 0 && <aside className={styles.standing} aria-label="Where it ranks"><div className={styles.standingHead}><span className={styles.standingLabel}>Where it ranks</span>{standingTitle && <p className={styles.standingTitle}>{standingTitle}</p>}</div><div className={styles.standingBody}>{standing.map((sentence) => <p key={sentence}>{sentence}</p>)}</div></aside>}
    <div className={styles.findings}>
      {finding(home, price?.basis === "transactions" ? "Median recorded sale price" : "Typical home value", "No current home-value index or recent qualifying sale-price median is available.", price?.basis === "transactions" ? "Qualifying sales—not the value of every home." : "Modeled value—not a sale price or appraisal.")}
      {finding(rent, "Typical market rent", "No current market-rent index available; survey rents are not asking rents.", "Market benchmark, not existing tenants’ bills. Utilities extra.")}
    </div>
    {/* The chart key reads after the charts it explains, with their other notes. */}
    <p className={styles.instruction}>Box: middle half of {places} · line: median · ends: min–max. Hover, drag or use <kbd>←</kbd> <kbd>→</kbd> to explore {places}.</p>
    <p className={styles.annotation}>Same-month statewide comparisons—not just nearby {places}. Trends use separate scales and nominal dollars, not inflation-adjusted.</p>
    {occupied && occupied.value >= 0 && occupied.value <= 1 && <div className={styles.stock} data-portrait="tenure">
      <div className={styles.tenureLabels}><span><b>{formatMetric(occupied.value, occupied.unit, occupied.metric_id)}</b> Owner-occupied</span><span>Rented <b>{formatMetric(1 - occupied.value, occupied.unit, occupied.metric_id)}</b></span></div>
      <div className={styles.tenureBar} role="img" aria-label={`${formatMetric(occupied.value, occupied.unit, occupied.metric_id)} owner-occupied; ${formatMetric(1 - occupied.value, occupied.unit, occupied.metric_id)} rented, among occupied homes`}><span style={{ width: `${occupied.value * 100}%` }} /></div>
      <p className={styles.annotation}>Occupied homes · Census ACS {surveyYears(occupied.period_start, occupied.period_end)} · 90% margin: {marginLabel(occupied.value, uncertainties.value.get(occupied.metric_id)?.margin ?? null, occupied.unit, occupied.metric_id)}</p>
    </div>}
  </section>;
}

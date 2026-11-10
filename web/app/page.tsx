import type { Metadata } from "next";
import Link from "next/link";

import home from "./_poster/home.module.css";
import original from "./homepage.module.css";
import "./housing-entry.css";
import "./state-navigation.css";
import "./data-scale.css";
import { DataScale, ScaleSignature } from "@/components/DataScale";
import { Glossed } from "@/components/Glossed";
import { Masthead } from "@/components/Masthead";
import { NationalCoverageMap } from "@/components/NationalCoverageMap";
import { PlaceSearch } from "@/components/PlaceSearch";
import { HomeStories } from "@/components/HomeStories";
import { api, nationalMortgageRate, nationalScoreSeries, regionsWithData } from "@/lib/api";
import { dataScale } from "@/lib/dataScale";
import { KIND_LABELS, KIND_MEANINGS, kindOf, type RecordType } from "@/lib/kinds";
import { latestPrice, marketTakeaways, monthLabel, scoreboard, type ScoreTile } from "@/lib/nationalScoreboard";
import { propertyScale } from "@/lib/propertyScale";
import { pageMetadata } from "@/lib/meta";

export const metadata: Metadata = pageMetadata({
  title: "Housing Intelligence — Find your place",
  description: "A clearer picture of the place you could call home. Free housing data with sources for every figure; detailed coverage starts with New Jersey.",
  path: "/",
});

const TONE_WORDS = { harder: "Harder", easier: "Easier", mixed: "Mixed", flat: "Little changed", context: "Context" };
const SHORT_KIND: Record<RecordType, string> = { survey: "Survey", administrative: "Records", determination: "Determination", benchmark: "Benchmark", calculated: "Calculated", modelled: "Modelled" };
// Which figures back each takeaway; the takeaway leads, the figures are its evidence.
const EVIDENCE: Record<string, string[]> = { rate: ["rate"], afford: ["afford", "income"], choice: ["listings", "days", "cuts"], prices: ["prices"], rent: ["rent"], vacancy: ["vacancy"], building: ["starts", "supply"], sales: ["sales"], ownership: ["ownership"], delinquency: ["delinquency"] };

// The four groups the table prints its figures under. A figure sits in the group of the
// takeaway it backs, in this order.
const GROUPS = [
  { label: "Buying", ids: ["rate", "afford", "prices", "choice"] },
  { label: "Renting", ids: ["rent", "vacancy"] },
  { label: "Building", ids: ["building", "sales"] },
  { label: "Owners", ids: ["ownership", "delinquency"] },
];

const points = (tile: ScoreTile) => tile.trend.flatMap((p) => (p.value === null ? [] : [{ date: p.date, value: p.value }]));
/** The reading a year before the latest one, or null when the series is shorter than that. */
function yearAgo(tile: ScoreTile) {
  const rows = points(tile), last = rows.at(-1);
  if (!last) return null;
  const target = `${Number(last.date.slice(0, 4)) - 1}${last.date.slice(4)}`;
  return rows.filter((p) => p.date <= target).at(-1)?.value ?? null;
}

/** An earlier reading of a figure, written the way its latest value is written
    ("$87,460" gives "$83,160", "1.18M" gives "1.10M"). */
function written(tile: ScoreTile, v: number): string {
  const found = tile.value.match(/^([+\u2212-]?)([^\d+\u2212-]*)(\d[\d,]*\.?\d*)(.*)$/);
  if (!found) return String(v);
  const shown = parseFloat(found[3].replace(/,/g, "")), factor = Math.abs(tile.now) / shown || 1, places = (found[3].split(".")[1] ?? "").length;
  const body = (Math.abs(v) / factor).toLocaleString("en-US", { minimumFractionDigits: places, maximumFractionDigits: places });
  return `${v < 0 ? "\u2212" : found[1] ? "+" : ""}${found[2]}${body}${found[4]}`;
}

/** Two years of a figure, small, with last year's level dashed across it. */
function Spark({ tile }: { tile: ScoreTile }) {
  const rows = points(tile), then = yearAgo(tile);
  if (rows.length < 2) return null;
  const values = rows.map((p) => p.value), low = Math.min(...values), span = Math.max(...values) - low || 1;
  const y = (v: number) => 22 - ((v - low) / span) * 20;
  return <svg className={home.spark} viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
    {then !== null && <line x1="0" x2="100" y1={y(then)} y2={y(then)} stroke="currentColor" strokeOpacity=".55" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
    <polyline points={values.map((v, i) => `${(i / (values.length - 1)) * 100},${y(v)}`).join(" ")} fill="none" stroke="var(--edge)" strokeWidth="1.75" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
  </svg>;
}

/** The home page in the place pages' voice: the coverage map, real posters. */
export default async function HousingLandingPage() {
  const rate = await nationalMortgageRate();
  const series = await nationalScoreSeries(rate?.metric_id);
  const [metrics, sources, places] = await Promise.all([api.metrics(), api.sources(), regionsWithData()]);
  const scale = dataScale(metrics, sources, places), properties = propertyScale();

  const tiles = scoreboard(series);
  // Prices still rising is no gift to buyers even when the rise slows, so that card reads mixed.
  // Figures that are neither easier nor harder for a buyer (sales, homeownership, delinquencies) read as context.
  const toneOf = (id: string, group: ScoreTile[]) => { const tones = new Set(group.map((t) => t.tone)); const only = tones.size === 1 ? [...tones][0] : "mixed"; return id === "prices" ? "mixed" as const : only === "neutral" ? "context" as const : only === "flat" ? "flat" as const : only as "harder" | "easier" | "mixed"; };
  // Affordability's tone is its own: income rising is good news, but the card is about the share.
  const told = marketTakeaways(tiles, latestPrice(series.newHomePrice)).map((t) => { const group = tiles.filter((tile) => EVIDENCE[t.id]?.includes(tile.id)); return { id: t.id, headline: t.headline, detail: t.detail, tiles: group, tone: toneOf(t.id, t.id === "afford" ? group.filter((tile) => tile.id === "afford") : group) }; });
  const said = (tone: string) => told.filter((t) => t.tone === tone).map((t) => t.headline);
  const others = told.length - said("harder").length - said("easier").length;
  // Every figure, under the group of the takeaway it backs; one no takeaway names joins the last.
  const groupOf = (id: string) => GROUPS.findIndex((g) => g.ids.some((story) => EVIDENCE[story]?.includes(id)));
  const order = GROUPS.flatMap((g) => g.ids.flatMap((story) => EVIDENCE[story] ?? []));
  const grouped = GROUPS.map((g, i) => ({ label: g.label, tiles: tiles.filter((t) => { const at = groupOf(t.id); return (at < 0 ? GROUPS.length - 1 : at) === i; }).sort((x, y) => order.indexOf(x.id) - order.indexOf(y.id)) })).filter((g) => g.tiles.length > 0);
  // A figure reads by its own direction, with the takeaways' two rules: prices still rising
  // is mixed, and a figure that is neither easier nor harder for a buyer is context.
  // A glossary word in a figure's name is defined once, at its first row.
  const defined = new Set<string>();
  const reading = (t: ScoreTile) => (t.id === "prices" ? "mixed" : t.tone === "neutral" ? "context" : t.tone);
  const newest = tiles.map((t) => t.trend.at(-1)?.date ?? "").sort().at(-1);

  return <div className={`search-first-home ${original.home}`}>
    <Masthead affordability={{ kind: "route", active: false }} search={{ after: ".home-search" }} />
    <main id="main-content" tabIndex={-1} className={`shell ${home.home}`}>
      <section className={home.entry} aria-labelledby="home-find-heading">
        <div>
          <h1 id="home-find-heading">Housing <em>Intelligence</em></h1>
          <p className={home.assurance}>Free · No fees or ads</p>
          <div className="home-search"><PlaceSearch variant="hero" /></div>
          <div className={home.scale}><ScaleSignature stats={scale} properties={properties} /><DataScale stats={scale} properties={properties} heading="About these figures" /></div>
        </div>
        <div className={home.map}>
          <div className={original.map}><NationalCoverageMap preview focusedEntry /></div>
          <p><span>A coverage map, not prices. Alaska and Hawaii not shown.</span><Link href="/states/new-jersey">Detailed coverage: New Jersey ↗</Link></p>
        </div>
      </section>

      {tiles.length > 0 && <section id="us-market" className={home.section}>
        <div className={home.head}><h2>The US housing market</h2>{newest && <span>Latest through {monthLabel(newest)}, against a year earlier</span>}</div>
        {/* The whole market in a line, which doubles as the key to the table's colours. */}
        {told.length > 0 && <p className={home.glance}>
          {said("harder").length > 0 && <span className={home.harder}><b>Harder</b> {said("harder").join(", ")}</span>}
          {said("easier").length > 0 && <span className={home.easier}><b>Easier</b> {said("easier").join(", ")}</span>}
          {others > 0 && <span className={home.mixed}><b>Mixed or little changed</b> {others === told.length ? "all" : "the other"} {others}</span>}
        </p>}
        {/* Every figure in one table, as an indicators page prints them: the latest, a year
            earlier, the change, two years of it, how it reads, and where it comes from.
            A phone keeps the name, the latest, the change and the line, and moves the
            reading, period and source under the name. */}
        <table className={home.table}>
          <caption className="visually-hidden">US housing market figures, the latest against a year earlier</caption>
          <thead><tr><th scope="col">Indicator</th><th scope="col" className={home.num}>Latest</th><th scope="col" className={`${home.num} ${home.wide}`}>A year ago</th><th scope="col" className={home.num}>Change</th><th scope="col">Two years</th><th scope="col" className={home.wide}>Reading</th><th scope="col" className={home.wide}>Period</th><th scope="col" className={home.wide}>Source</th></tr></thead>
          {grouped.map((group) => <tbody key={group.label}>
            <tr className={home.groupRow}><th colSpan={8} scope="rowgroup">{group.label}</th></tr>
            {group.tiles.map((t) => { const tone = reading(t), then = t.then ?? yearAgo(t), kind = kindOf(t.metricId); return <tr key={t.id} className={home[tone]}>
              <th scope="row"><Glossed text={t.label} defined={defined} /><small className={home.under}><b>{TONE_WORDS[tone]}</b> · {t.period} · <a href={t.source.href} target="_blank" rel="noreferrer noopener">{t.source.name}</a></small></th>
              <td className={home.num}><b>{t.value}</b></td>
              <td className={`${home.num} ${home.wide}`}>{then === null ? "—" : written(t, then)}</td>
              <td className={`${home.num} ${home.change}`}>{t.change ?? "—"}</td>
              <td className={home.sparkCell}><Spark tile={t} /></td>
              <td className={`${home.wide} ${home.reading}`}>{TONE_WORDS[tone]}</td>
              <td className={home.wide}>{t.period}</td>
              <td className={home.wide}>{kind && <span title={`${KIND_LABELS[kind]}: ${KIND_MEANINGS[kind]}`}>{SHORT_KIND[kind]} · </span>}<a href={t.source.href} target="_blank" rel="noreferrer noopener">{t.source.name}</a></td>
            </tr>; })}
          </tbody>)}
        </table>
        <p className={home.key}>Change is against a year earlier. Each line is two years; the dashed rule is the level a year ago.</p>
      </section>}

      <div className={home.storiesCard}><HomeStories /></div>
    </main>
  </div>;
}

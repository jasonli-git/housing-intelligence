import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";

import home from "./home.module.css";
import original from "../homepage.module.css";
import "../housing-entry.css";
import "../state-navigation.css";
import "../data-scale.css";
import { DataScale, ScaleSignature } from "@/components/DataScale";
import { Masthead } from "@/components/Masthead";
import { NationalCoverageMap } from "@/components/NationalCoverageMap";
import { PlaceSearch } from "@/components/PlaceSearch";
import { HomeStories } from "@/components/HomeStories";
import { HOME_TOOLS } from "@/components/HomeTools";
import { api, nationalMortgageRate, nationalScoreSeries, regionsWithData } from "@/lib/api";
import { dataScale } from "@/lib/dataScale";
import { KIND_LABELS, KIND_MEANINGS, kindOf, type RecordType } from "@/lib/kinds";
import { displayName } from "@/lib/names";
import { latestPrice, marketTakeaways, monthLabel, scoreboard, type ScoreTile } from "@/lib/nationalScoreboard";
import { regionPath, resolvePlace } from "@/lib/placeRoutes";
import { propertyScale } from "@/lib/propertyScale";
import { PRIMARY_STATE } from "@/lib/states";

export const metadata: Metadata = { title: "Housing Intelligence — Mockup" };

const dollars = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;
const SAMPLES = [["County", "mercer-county", home.county], ["Town", "princeton", home.town], ["ZIP code", "zip-07828", home.zip]] as const;
const TONE_WORDS = { harder: "Harder", easier: "Easier", mixed: "Mixed", flat: "Little changed" };
const SHORT_KIND: Record<RecordType, string> = { survey: "Survey", administrative: "Records", determination: "Determination", benchmark: "Benchmark", calculated: "Calculated", modelled: "Modelled" };
// Which figures back each takeaway; the takeaway leads, the figures are its evidence.
const EVIDENCE: Record<string, string[]> = { rate: ["rate"], choice: ["listings", "days", "cuts"], prices: ["prices"], rent: ["rent"], building: ["starts", "supply"] };
const TOOL_COLOURS = ["--kind-budget", "--kind-guide", "--kind-tax", "--kind-zip", "--kind-help", "--kind-state"];

function Trend({ values }: { values: number[] }) {
  const low = Math.min(...values), span = Math.max(...values) - low || 1;
  return <svg viewBox="0 0 300 64" preserveAspectRatio="none" aria-hidden="true"><polyline points={values.map((v, i) => `${(i / (values.length - 1)) * 300},${60 - ((v - low) / span) * 56}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" /></svg>;
}

const points = (tile: ScoreTile) => tile.trend.flatMap((p) => (p.value === null ? [] : [{ date: p.date, value: p.value }]));
/** The reading a year before the latest one, or null when the series is shorter than that. */
function yearAgo(tile: ScoreTile) {
  const rows = points(tile), last = rows.at(-1);
  if (!last) return null;
  const target = `${Number(last.date.slice(0, 4)) - 1}${last.date.slice(4)}`;
  return rows.filter((p) => p.date <= target).at(-1)?.value ?? null;
}

/** Two years of one figure, with last year's level dashed across it. */
function YearLine({ tile }: { tile: ScoreTile }) {
  const rows = points(tile), then = yearAgo(tile);
  if (rows.length < 2) return null;
  const values = rows.map((p) => p.value), low = Math.min(...values), span = Math.max(...values) - low || 1;
  const y = (v: number) => 72 - ((v - low) / span) * 64, last = rows.at(-1)!;
  const show = (v: number) => (tile.unit === "percent" ? `${v.toFixed(tile.id === "rate" ? 2 : 1)}%` : String(v));
  return <div className={home.chart}>
    <svg viewBox="0 0 240 80" preserveAspectRatio="none" aria-hidden="true">
      {then !== null && <line x1="0" x2="240" y1={y(then)} y2={y(then)} stroke="currentColor" strokeOpacity=".5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
      <polyline points={values.map((v, i) => `${(i / (values.length - 1)) * 240},${y(v)}`).join(" ")} fill="none" stroke="var(--edge)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
    <p>{then !== null && <span>{show(then)} a year ago</span>}<b>{show(last.value)}</b></p>
  </div>;
}

/** Each figure now against a year ago, scaled within its own pair. */
function Pairs({ tiles }: { tiles: ScoreTile[] }) {
  return <div className={home.pairs}>{tiles.map((t) => { const then = yearAgo(t), now = points(t).at(-1)?.value ?? 0, peak = Math.max(then ?? 0, now) || 1; return <div key={t.id}>
    <span>{t.label}</span>
    {then !== null && <i style={{ width: `${(then / peak) * 100}%` }} />}
    <i data-now style={{ width: `${(now / peak) * 100}%` }} />
  </div>; })}<small>Pale bar: a year ago</small></div>;
}

/** Monthly starts as bars, and months of supply against the balanced mark. */
function Building({ tiles }: { tiles: ScoreTile[] }) {
  const starts = tiles.find((t) => t.id === "starts"), supply = tiles.find((t) => t.id === "supply");
  const rows = starts ? points(starts) : [], peak = Math.max(...rows.map((p) => p.value), 1), months = supply ? points(supply).at(-1)?.value ?? null : null, top = Math.max(12, months ?? 0);
  return <div className={home.chart}>
    {rows.length > 1 && <div className={home.bars} aria-hidden="true">{rows.map((p) => <i key={p.date} style={{ height: `${(p.value / peak) * 100}%` }} />)}</div>}
    {months !== null && <div className={home.gauge} aria-hidden="true"><div><u style={{ left: `${(6 / top) * 100}%` }} /><i style={{ left: `${(months / top) * 100}%` }} /></div><small>Months of supply; the mark is six, roughly balanced</small></div>}
  </div>;
}

/** The home page in the place pages' voice: the coverage map, real posters. */
export default async function MockupHome() {
  const rate = await nationalMortgageRate();
  const series = await nationalScoreSeries(rate?.metric_id);
  const [metrics, sources, places] = await Promise.all([api.metrics(), api.sources(), regionsWithData()]);
  const scale = dataScale(metrics, sources, places), properties = propertyScale();

  const tiles = scoreboard(series);
  // Prices still rising is no gift to buyers even when the rise slows, so that card reads mixed.
  const toneOf = (id: string, group: ScoreTile[]) => { const tones = new Set(group.map((t) => t.tone)); const only = tones.size === 1 ? [...tones][0] : "mixed"; return id === "prices" || only === "neutral" ? "mixed" as const : only === "flat" ? "flat" as const : only as "harder" | "easier" | "mixed"; };
  const told = marketTakeaways(tiles, latestPrice(series.newHomePrice)).map((t) => { const group = tiles.filter((tile) => EVIDENCE[t.id]?.includes(tile.id)); return { id: t.id, headline: t.headline, detail: t.detail, tiles: group, tone: toneOf(t.id, group) }; });
  // A figure whose takeaway did not run still shows, so nothing drops silently.
  const rest = tiles.filter((tile) => !told.some((t) => t.tiles.includes(tile)));
  const stories = rest.length ? [...told, { id: "rest", headline: "Other figures", detail: "", tiles: rest, tone: "mixed" as const }] : told;
  const newest = tiles.map((t) => t.trend.at(-1)?.date ?? "").sort().at(-1);

  const previews = (await Promise.all(SAMPLES.map(async ([kind, slug, colour]) => {
    const id = resolvePlace("nj", slug);
    if (id === null) return [];
    const [region, values] = await Promise.all([api.region(id), api.observations(id, "zhvi_sfr")]);
    const history = (values?.observations ?? []).map((o) => o.value);
    return region && history.length > 1 ? [{ kind, id, colour, name: displayName(region), history }] : [];
  }))).flat();
  // The state has no Zillow level here, so its card reads recorded sales instead.
  const stateSales = ((await api.observations(PRIMARY_STATE.regionId, "sr1a_median_sale_price"))?.observations ?? []).map((o) => o.value);

  return <div className={`search-first-home ${original.home}`}>
    <Masthead affordability={{ kind: "route", active: false }} search={false} simple />
    <main id="main-content" tabIndex={-1} className={`shell ${home.home}`}>
      <section className={home.entry} aria-labelledby="home-find-heading">
        <div>
          <h1 id="home-find-heading">Housing <em>Intelligence</em></h1>
          <p className={home.assurance}>Free · No fees or ads</p>
          <div className="home-search"><PlaceSearch variant="hero" prefix="/mockup" /></div>
          <div className={home.scale}><ScaleSignature stats={scale} properties={properties} /><DataScale stats={scale} properties={properties} heading="About these figures" /></div>
        </div>
        <div className={home.map}>
          <div className={original.map}><NationalCoverageMap preview focusedEntry /></div>
          <p><span>A coverage map, not prices. Alaska and Hawaii not shown.</span><Link href="/mockup/states/new-jersey">Detailed coverage: New Jersey ↗</Link></p>
        </div>
      </section>

      {previews.length > 0 && <section id="places" className={home.section}>
        <h2>Every place has its own page</h2>
        <div className={home.places}>{stateSales.length > 1 && <Link href="/mockup/states/new-jersey" prefetch={false} className={`${home.place} ${home.state}`}>
          <small>State</small><strong>New Jersey</strong><b>{dollars(stateSales.at(-1)!)}</b><small>Median sale, NJ SR-1A</small><Trend values={stateSales.slice(-120)} />
        </Link>}
        {previews.map((p) => <Link key={p.id} href={`/mockup${regionPath(p.id)}`} prefetch={false} className={`${home.place} ${p.colour}`}>
          <small>{p.kind}</small><strong>{p.name}</strong><b>{dollars(p.history.at(-1)!)}</b><small>Typical home, Zillow</small><Trend values={p.history.slice(-120)} />
        </Link>)}</div>
      </section>}

      {tiles.length > 0 && <section id="us-market" className={home.section}>
        <div className={home.head}><h2>The US housing market</h2>{newest && <span>Latest through {monthLabel(newest)}, against a year earlier</span>}</div>
        <div className={home.takeaways}>{stories.map((story) => <article key={story.id} className={home[story.tone]} title={story.detail}>
          <span className={home.tag}>{TONE_WORDS[story.tone]}</span>
          <h3>{story.headline}</h3>
          <p className="visually-hidden">{story.detail}</p>
          {story.id === "choice" ? <Pairs tiles={story.tiles} /> : story.id === "building" ? <Building tiles={story.tiles} /> : story.tiles[0] && <YearLine tile={story.tiles[0]} />}
          <ul>{story.tiles.map((t) => { const kind = kindOf(t.metricId); return <li key={t.id}>
            <span className="visually-hidden">{t.summary}</span>
            <span aria-hidden="true">{t.label} {t.value}</span>{kind && <> · <span title={`${KIND_LABELS[kind]}: ${KIND_MEANINGS[kind]}`}>{SHORT_KIND[kind]}</span></>} · <a href={t.source.href} target="_blank" rel="noreferrer noopener">{t.source.name}</a>
          </li>; })}</ul>
        </article>)}</div>
      </section>}

      <div className={home.storiesCard}><HomeStories /></div>

      <section id="tools" className={home.section}>
        <h2>Tools</h2>
        <ul className={`${home.tools} home-tools-grid`}>{HOME_TOOLS.map((tool, i) => <li key={tool.href}><Link href={tool.href} data-tool={tool.href.slice(1)} prefetch={false} style={{ "--tool": `var(${TOOL_COLOURS[i]})` } as CSSProperties}><strong>{tool.title}</strong><span>{tool.text} →</span></Link></li>)}</ul>
      </section>
    </main>
  </div>;
}

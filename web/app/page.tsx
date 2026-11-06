import type { Metadata } from "next";
import Link from "next/link";

import home from "./_poster/home.module.css";
import original from "./homepage.module.css";
import "./housing-entry.css";
import "./state-navigation.css";
import "./data-scale.css";
import { DataScale, ScaleSignature } from "@/components/DataScale";
import { FlipCard } from "@/components/FlipCard";
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

// The takeaways in four groups, so ten read as a dashboard rather than a list. `span` is
// each group's share of the six-column desktop grid: buying and renting fill the first
// row, building and owners split the second.
const GROUPS = [
  { label: "Buying", ids: ["rate", "afford", "prices", "choice"], span: 4 },
  { label: "Renting", ids: ["rent", "vacancy"], span: 2 },
  { label: "Building", ids: ["building", "sales"], span: 3 },
  { label: "Owners", ids: ["ownership", "delinquency"], span: 3 },
];

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
    <p>{tile.id === "rate" ? <>{tile.then !== null && <span>From {show(tile.then)}</span>}<b>{tile.then === null ? show(tile.now) : `${tile.now >= tile.then ? "Up" : "Down"} ${Math.abs(tile.now - tile.then).toFixed(2)} points in a year`}</b></> : then !== null && <span>Against {show(then)} the year before</span>}</p>
  </div>;
}

/** A card's sources, each once, with the distinct kinds of figure it supplied. */
function bySource(tiles: ScoreTile[]) {
  const found = new Map<string, { source: ScoreTile["source"]; kinds: NonNullable<ReturnType<typeof kindOf>>[] }>();
  for (const t of tiles) {
    const entry = found.get(t.source.name) ?? { source: t.source, kinds: [] };
    const kind = kindOf(t.metricId);
    if (kind && !entry.kinds.includes(kind)) entry.kinds.push(kind);
    found.set(t.source.name, entry);
  }
  return [...found.values()];
}

/** Each figure now against a year ago, scaled within its own pair. */
function Pairs({ tiles }: { tiles: ScoreTile[] }) {
  return <div className={home.pairs}>{tiles.map((t) => { const then = yearAgo(t), now = points(t).at(-1)?.value ?? 0, peak = Math.max(then ?? 0, now) || 1; return <div key={t.id}>
    <span>{t.label}</span>
    <div>{then !== null && <i style={{ width: `${(then / peak) * 100}%` }} />}<i data-now style={{ width: `${(now / peak) * 100}%` }} /></div>
    <b>{t.value}</b>
  </div>; })}<small>Pale bar: a year ago</small></div>;
}

/** Monthly starts as bars, and months of supply against the balanced mark. */
function Building({ tiles }: { tiles: ScoreTile[] }) {
  const starts = tiles.find((t) => t.id === "starts"), supply = tiles.find((t) => t.id === "supply");
  const rows = starts ? points(starts) : [], peak = Math.max(...rows.map((p) => p.value), 1), months = supply ? points(supply).at(-1)?.value ?? null : null, top = Math.max(12, months ?? 0);
  return <div className={home.chart}>
    {rows.length > 1 && <div className={home.bars} aria-hidden="true">{rows.map((p) => <i key={p.date} style={{ height: `${(p.value / peak) * 100}%` }} />)}</div>}
    {months !== null && <div className={home.gauge} aria-hidden="true"><div><u style={{ left: `${(6 / top) * 100}%` }} /><i style={{ left: `${(months / top) * 100}%` }} /></div><small>{months.toFixed(1)} months of supply; the mark is six, roughly balanced</small></div>}
  </div>;
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
  // A figure whose takeaway did not run still shows, so nothing drops silently.
  const rest = tiles.filter((tile) => !told.some((t) => t.tiles.includes(tile)));
  const stories = rest.length ? [...told, { id: "rest", headline: "Other figures", detail: "", tiles: rest, tone: "mixed" as "harder" | "easier" | "mixed" | "flat" | "context" }] : told;
  const tile = (id: string) => tiles.find((t) => t.id === id);
  // Each takeaway leads with where things stand; its chart and change show which way they moved.
  const lead = (id: string) => ({
    rate: tile("rate") && { value: tile("rate")!.value, label: "Typical 30-year mortgage rate" },
    choice: tile("listings") && { value: tile("listings")!.value, label: `Homes for sale${tile("days") ? `, ${tile("days")!.value} on the market` : ""}` },
    prices: tile("prices") && { value: tile("prices")!.value, label: "Change in home prices over a year" },
    rent: tile("rent") && { value: tile("rent")!.value, label: "Change in rents over a year" },
    building: tile("starts") && { value: tile("starts")!.value, label: "New homes started, at a yearly pace" },
    afford: tile("afford") && { value: tile("afford")!.value, label: "Of a typical income goes to a typical new home’s payment" },
    vacancy: tile("vacancy") && { value: tile("vacancy")!.value, label: `Of rentals empty and for rent, ${tile("vacancy")!.period}` },
    sales: tile("sales") && { value: tile("sales")!.value, label: "New homes sold, at a yearly pace" },
    ownership: tile("ownership") && { value: tile("ownership")!.value, label: `Of homes lived in by their owners, ${tile("ownership")!.period}` },
    delinquency: tile("delinquency") && { value: tile("delinquency")!.value, label: `Of bank-held mortgages 30+ days late, ${tile("delinquency")!.period}` },
  } as Record<string, { value: string; label: string } | undefined>)[id];
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
        {/* Each card turns over: the takeaway on the front, the figures behind it on the back.
            The front keeps the figures as hidden text, so a screen reader hears them unturned.
            A takeaway no group names (the "Other figures" fallback) joins the last group. */}
        <div className={home.takeaways}>{GROUPS.map((group, g) => ({ ...group, cards: stories.filter((s) => group.ids.includes(s.id) || (g === GROUPS.length - 1 && !GROUPS.some((o) => o.ids.includes(s.id)))) }))
          .filter((group) => group.cards.length > 0).map((group) => <section key={group.label} className={home.group} aria-label={group.label}
            style={{ "--span": group.span, "--cards": group.cards.length } as React.CSSProperties}>
          <h3 className={home.groupLabel}>{group.label}</h3>
          <div className={home.groupCards}>{group.cards.map((story) => <FlipCard key={story.id} className={home[story.tone]}
          front={<>
            <span className={home.tag}>{TONE_WORDS[story.tone]}</span>
            <h4>{story.headline}</h4>
            {lead(story.id) && <p className={home.lead}><b>{lead(story.id)!.value}</b>{lead(story.id)!.label}</p>}
            {/* Screen-reader copies of the back: a definition popup cannot open in hidden
                text, so the glossary check skips them (as /changes's hidden caption). */}
            <p className="visually-hidden" data-terms="off">{story.detail}</p>
            <ul className="visually-hidden" data-terms="off">{story.tiles.map((t) => <li key={t.id}>{t.summary}</li>)}</ul>
          </>}
          back={<>
            <span className={home.tag}>{story.headline}</span>
            {story.detail && <p className={home.detail}>{story.detail}</p>}
            {story.id === "choice" ? <Pairs tiles={story.tiles} /> : story.id === "building" ? <Building tiles={story.tiles} /> : story.tiles[0] && <YearLine tile={story.tiles[0]} />}
            {/* One footnote per card: each source once, with the kinds of figure it gave. */}
            <p className={home.cite}>{bySource(story.tiles).map(({ source, kinds }, i) => <span key={source.name}>{i > 0 && " · "}{kinds.map((kind, k) => <span key={kind} title={`${KIND_LABELS[kind]}: ${KIND_MEANINGS[kind]}`}>{k > 0 ? ", " : ""}{k > 0 ? SHORT_KIND[kind].toLowerCase() : SHORT_KIND[kind]}</span>)}{kinds.length > 0 && " · "}<a href={source.href} target="_blank" rel="noreferrer noopener">{source.name}</a></span>)}</p>
          </>}
        />)}</div>
        </section>)}</div>
      </section>}

      <div className={home.storiesCard}><HomeStories /></div>
    </main>
  </div>;
}

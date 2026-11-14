import Link from "next/link";
import type { ReactNode } from "react";

import { api, type PacketLevel } from "@/lib/api";
import { formatValue } from "@/lib/format";
import { checklist, type CheckItem, type GuideData } from "@/lib/guide";
import { fullPath } from "@/lib/placeRoutes";
import { highest, ordinal, share, sizePct, standing, standsOut, type Standing, type Takeaway } from "@/lib/takeaways";

/**
 * A town's briefing, as slides (#498, made general and short by #511, Milestone 62).
 *
 * The same seven slides, in the same order, for every New Jersey town, so two briefings
 * can be read side by side (ARCHITECTURE #520): title; at a glance, the three topics where
 * the town sits furthest from the state's median town (`standsOut`, #512); what homes
 * cost; property taxes; flood risk; the homes and the market; sources. The commute is one
 * of the topics At a glance can pick, but has no slide of its own: the owner wants a
 * distance-to-the-train figure before a commute slide.
 *
 * Built on the server at export time, so the slides are in the page's HTML; the browser
 * only moves between them (`Briefing.tsx`). Every slide follows one layout: a running
 * section header; an action title stating the slide's conclusion, so the titles alone tell
 * the story; one key figure beside New Jersey's median town; one picture; one line of
 * context; and a footer with the source and date.
 */

export type Slide = {
  key: string; section: string; kicker: string; headline: string; why?: string; source?: string;
  figure?: { value: string; label: string; versus?: string }; standing?: Standing | null;
  body?: ReactNode; flagged?: boolean; plain?: boolean;
  /** Speaker notes: the full findings, limits and caveats the slide leaves out. */
  notes?: ReactNode;
};

const usd = (v: number) => formatValue(v, "usd");
const pct = (v: number) => `${Math.round(v * 100)}%`;
const year = (d: string) => d.slice(0, 4);

/** The measures whose New Jersey median town the slides set beside the town's figure. */
const MEDIAN_OF = ["sr1a_median_sale_price", "modiv_median_tax_bill", "sr1a_turnover_per_1000", "fema_flood_homes_share", "modiv_median_year_built"] as const;
export type Medians = Partial<Record<(typeof MEDIAN_OF)[number], number>>;

let medians: Promise<Medians> | null = null;

/** The middle of each measure's published town ranking: one answer for every town, so
 *  asked once per build worker rather than once a page. */
export function njMedians(): Promise<Medians> {
  medians ??= Promise.all(MEDIAN_OF.map(async (id) => {
    const v = ((await api.values(id, "municipality"))?.items ?? []).map((x) => x.value).filter(Number.isFinite).sort((a, b) => a - b);
    return v.length ? [id, v[Math.floor(v.length / 2)]] as const : null;
  })).then((pairs) => Object.fromEntries(pairs.filter((p) => p !== null)));
  return medians;
}

/** New Jersey's towns as a line, this town as a dot, the median town as a tick. */
function Strip({ level, low, high }: { level?: PacketLevel; low: string; high: string }) {
  if (!level || level.percentile == null) return null;
  return <div className="bf-strip" aria-hidden="true">
    <span className="bf-strip-track"><b style={{ left: "50%" }} /><i style={{ left: `${sizePct(level)}%` }} /></span>
    <span className="bf-strip-ends"><small>{low}</small><small>NJ median town</small><small>{high}</small></span>
  </div>;
}

/** A check in full, for the notes: what the figures say, and what they cannot. */
const noteOf = (c?: CheckItem) => c ? <div key={c.key}><b>{c.title}.</b> {c.finding}{c.flag ? ` ${c.flag}.` : ""} <i>{c.limitation}</i></div> : null;

/** How each At a glance topic reads as a tile. */
const TILE: Record<Takeaway["key"], { value: (l: PacketLevel) => string; label: string }> = {
  tax: { value: (l) => usd(l.value), label: "typical tax bill a year" },
  price: { value: (l) => usd(l.value), label: "typical home price" },
  commute: { value: (l) => `${Math.round(l.value)} min`, label: "average commute" },
  flood: { value: (l) => pct(l.value), label: "of homes in FEMA’s high-risk flood zone" },
  built: { value: (l) => String(Math.round(l.value)), label: "year the typical home was built" },
  turnover: { value: (l) => `${Math.round(l.value)} per 1,000`, label: "homes sold each year" },
};

export const SECTIONS = ["Overview", "Cost", "Risk", "Homes", "Sources"];

/** The seven slides, from the guide's own data and checks and the state's median towns.
 *  `art` is the title slide's picture; `builtAt` dates the briefing. */
export function slidesFor(data: GuideData, nj: Medians, { art, builtAt }: { art?: ReactNode; builtAt: Date }): Slide[] {
  const lv = (id: string) => data.levels.find((l) => l.metric_id === id);
  const name = data.region.name;
  const id = data.region.region_id;
  const county = data.region.parent?.name ?? "";
  const sourceOf = (l?: PacketLevel) => {
    if (!l) return undefined;
    const s = data.sources.find((x) => x.source_id === l.source_id);
    // A rate this site works out (turnover) names the records it is worked out from.
    if (l.metric_id === "sr1a_turnover_per_1000") return `Worked out from NJ deed records (SR-1A), ${year(l.period_end)}`;
    return `Source: ${s?.publisher ?? s?.name ?? l.source_id}, ${year(l.period_end)}`;
  };
  const checks = checklist(data, { place: fullPath(id), tax: `/tax?town=${data.region.geoid}` });
  const check = (k: string) => checks.find((c) => c.key === k);
  const sale = lv("sr1a_median_sale_price"), zhvi = lv("zhvi_sfr");
  const price = sale ?? zhvi;
  const tax = lv("modiv_median_tax_bill"), turnover = lv("sr1a_turnover_per_1000"), sales = lv("sr1a_sales_count");
  const flood = lv("fema_flood_homes_share"), built = lv("modiv_median_year_built") ?? lv("acs_median_year_built");
  const income = lv("acs_median_hh_income");
  const versus = (v: number | undefined, fmt: (n: number) => string) => (v == null ? undefined : `NJ median town: ${fmt(v)}`);
  const top = standsOut(data.levels);
  const tileSay = (t: Takeaway, l: PacketLevel) => share(l, `${t.more} than`, `${t.less} than`);
  const asOf = [price, tax].filter(Boolean).map((l) => l!.period_end).sort().at(-1);
  const prepared = builtAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });

  return [
    { key: "title", notes: <p>Use the arrow keys or swipe to move, F for full screen, N to show or hide these notes. The same seven slides appear for every town, in the same order, so briefings can be compared.</p>, section: "Overview", kicker: "Briefing", plain: true,
      headline: name,
      body: <div className="bf-title">{art}<p>{county}{county ? ", " : ""}New Jersey</p><p>{SECTIONS.slice(1).join(" · ")}</p><p className="bf-title-date">Prepared {prepared}{asOf ? ` · latest figures from ${year(asOf)}` : ""}</p></div> },
    { key: "bottom", notes: <p>The three figures shown are the ones furthest from New Jersey’s median town, among home price, tax bill, commute, flood risk, home age and how often homes sell. Furthest from the middle is not the same as most important; the full page has every figure.</p>, section: "Overview", kicker: "At a glance",
      headline: `${name} stands out on ${top.map((x) => x.t.topic).join(", ").replace(/, ([^,]*)$/, " and $1")}`,
      why: "These are the three figures, of six, where it sits furthest from New Jersey’s median town.",
      body: <div className="bf-tiles">{top.map(({ t, l }) => <div key={t.key} className="bf-tile" data-mark={standing(l)?.mark}><b>{TILE[t.key].value(l)}</b><span>{TILE[t.key].label}</span><small>{tileSay(t, l)}</small></div>)}</div> },
    { key: "price", notes: <><p>The recorded sale price is the median of homes that actually sold here in the last twelve months to the date shown, from New Jersey’s deed records (SR-1A); sales between relatives and other non-market transfers are set aside. Zillow’s estimate models every home, sold or not, so the two differ.</p>{lv("sr1a_price_lower_quartile") && lv("sr1a_price_upper_quartile") && <p>Half of recorded sales fell between {usd(lv("sr1a_price_lower_quartile")!.value)} and {usd(lv("sr1a_price_upper_quartile")!.value)}.</p>}</>, section: "Cost", kicker: "What homes cost", standing: standing(price), source: sourceOf(price),
      headline: price ? `Homes here cost ${share(price, "more than", "less than")}` : "No home price is published here",
      figure: price ? { value: usd(price.value), label: sale ? "median recorded sale price" : "Zillow’s typical home value", versus: versus(nj.sr1a_median_sale_price, usd) } : undefined,
      why: "Price is the plainest measure of demand for a place and of who can live there.",
      body: <><Strip level={price} low="Least expensive" high="Most expensive" />{sale && zhvi && <p className="bf-note">Zillow’s estimate for the typical home is {usd(zhvi.value)}. Sales count only homes that changed hands.</p>}</> },
    { key: "tax", notes: noteOf(check("tax")), section: "Cost", kicker: "Property taxes", standing: standing(tax), source: sourceOf(tax), flagged: Boolean(check("tax")?.flag),
      headline: tax ? (highest(tax) <= 50 ? `Taxes here are the ${ordinal(highest(tax))} highest of ${tax.of} NJ towns` : `Taxes here are ${share(tax, "higher than", "lower than")}`) : "No tax bill is published here",
      figure: tax ? { value: usd(tax.value), label: "typical tax bill a year", versus: versus(nj.modiv_median_tax_bill, usd) } : undefined,
      why: "New Jersey’s tax bills are set by each town’s and school district’s budget, so they differ widely between neighbours.",
      body: <><Strip level={tax} low="Lowest bills" high="Highest bills" />{check("tax")?.flag && <p className="bf-flag">{check("tax")!.flag}</p>}</> },
    { key: "flood", notes: noteOf(check("flood")), section: "Risk", kicker: "Flood risk", standing: standing(flood), source: sourceOf(flood), flagged: Boolean(check("flood")?.flag),
      headline: flood ? `The share of homes in a flood zone is ${share(flood, "higher than", "lower than")}` : "Flood zones are not published here",
      figure: flood ? { value: pct(flood.value), label: "of homes in FEMA’s high-risk flood zone", versus: versus(nj.fema_flood_homes_share, pct) } : undefined,
      why: "Homes in FEMA’s high-risk zone usually need flood insurance to get a mortgage, and the cost follows the home.",
      body: <Strip level={flood} low="Fewest in a zone" high="Most in a zone" /> },
    { key: "homes", notes: <>{noteOf(check("age"))}{noteOf(check("turnover"))}</>, section: "Homes", kicker: "The homes and the market", standing: standing(built), source: sourceOf(built),
      headline: built ? `Homes here are ${share(built, "newer than", "older than")}` : "Home ages are not published here",
      figure: built ? { value: String(Math.round(built.value)), label: "year the typical home was built", versus: versus(nj.modiv_median_year_built, (n) => String(Math.round(n))) } : undefined,
      why: "The age of the homes records when a place grew; how often they sell shows how much comes onto the market.",
      body: <><Strip level={built} low="Oldest" high="Newest" />{turnover && <p className="bf-note">{Math.round(turnover.value)} of every 1,000 homes sell each year: {share(turnover, "more often than", "less often than")}.{sales ? ` ${Math.round(sales.value)} sold in the latest year.` : ""}</p>}</> },
    { key: "sources", notes: <ul>{data.sources.map((x) => <li key={x.source_id}>{x.name} — {x.publisher}. {x.license}.</li>)}</ul>, section: "Sources", kicker: "Sources", plain: true,
      headline: "Where every figure came from",
      body: <><p className="bf-note">{income ? `For scale: the median household here earns ${usd(income.value)} a year. ` : ""}All figures and dates are on <Link href={fullPath(id)}>{name}’s full page</Link>. Computed by fixed rules from public data; not written by AI.</p>
        <ul className="bf-sources">{[...new Set(data.sources.map((s) => s.publisher ?? s.name))].slice(0, 18).map((n) => <li key={n}>{n}</li>)}</ul></> },
  ];
}

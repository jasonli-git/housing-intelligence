"use client";

/**
 * The Buyer's guide as a briefing (#498; Director Note "Buyer's guide as a briefing",
 * decided 2026-11-11). One town in; the same twelve slides, in the same order, for every town.
 *
 * Every slide follows one layout: a running section header; an action title that states
 * the slide's conclusion, so the titles alone tell the story; one key figure set large
 * beside the median New Jersey town; one picture; "why it matters"; and a footer with the
 * source and date on the left and the town and page on the right. Built from the guide's
 * own data (`loadPlace`) and checks, plus each measure's published town ranking for the
 * NJ median.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { loadPlace } from "@/components/DecisionGuide";
import { affordAnswer, checklist, type CheckItem, type GuideData } from "@/lib/guide";
import type { PacketLevel } from "@/lib/api";
import type { SearchEntry } from "@/lib/search";
import { incomeFor } from "@/lib/cost";
import { formatValue } from "@/lib/format";
import { regionPath } from "@/lib/placeRoutes";

const usd = (v: number) => formatValue(v, "usd");
const pct = (v: number) => `${Math.round(v * 100)}%`;
/** A slide has room for one sentence per item: the first, without its trailing clauses. */
const first = (t: string) => (t.match(/^.*?[.;](\s|$)/)?.[0] ?? t).replace(/[;]\s*$/, ".").trim();
const ordinal = (n: number) => `${n}${[11, 12, 13].includes(n % 100) ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const year = (d: string) => d.slice(0, 4);

/** The measures whose NJ median the slides set beside the town's figure. */
const MEDIAN_OF = ["sr1a_median_sale_price", "modiv_median_tax_bill", "sr1a_turnover_per_1000", "fema_flood_homes_share", "modiv_median_year_built", "acs_mean_commute_minutes"] as const;
type Medians = Partial<Record<(typeof MEDIAN_OF)[number], number>>;

async function njMedians(artifactUrl: string): Promise<Medians> {
  const pairs = await Promise.all(MEDIAN_OF.map(async (id) => {
    try {
      const r = await fetch(`${artifactUrl}/rankings/${id}/municipality/latest/value.json`);
      const items: { value: number }[] = r.ok ? (await r.json()).items : [];
      const v = items.map((x) => x.value).filter(Number.isFinite).sort((a, b) => a - b);
      return v.length ? [id, v[Math.floor(v.length / 2)]] as const : null;
    } catch { return null; }
  }));
  return Object.fromEntries(pairs.filter((p) => p !== null));
}

/** A figure's percentile on its own scale (higher = larger value). Ranks on measures
 *  where lower is better run the other way, so their percentile is flipped back. */
const sizePct = (l: PacketLevel) => (l.direction === "lower_is_better" ? 100 - l.percentile! : l.percentile!);
const highest = (l: PacketLevel) => (l.direction === "lower_is_better" && l.rank != null && l.of != null ? l.of - l.rank + 1 : l.rank ?? 0);

type Standing = { mark: "typical" | "high" | "low" | "very-high" | "very-low"; words: string };
function standing(level: PacketLevel | undefined): Standing | null {
  if (!level || level.percentile == null) return null;
  const p = sizePct(level);
  const of = `${ordinal(highest(level))} highest of ${level.of}`;
  if (p >= 90) return { mark: "very-high", words: `Top tenth in NJ · ${of}` };
  if (p >= 70) return { mark: "high", words: `Above most of NJ · ${of}` };
  if (p <= 10) return { mark: "very-low", words: `Bottom tenth in NJ · ${of}` };
  if (p <= 30) return { mark: "low", words: `Below most of NJ · ${of}` };
  return { mark: "typical", words: `Typical for NJ · ${of}` };
}
/** "more than in 94% of NJ towns" / "less than in 70%": a percentile in words. */
const share = (l: PacketLevel, more: string, less: string) => {
  const p = Math.round(sizePct(l));
  return p >= 50 ? `${more} in ${p}% of NJ towns` : `${less} in ${100 - p}% of NJ towns`;
};

/** New Jersey's towns as a line, this town as a dot, the median town as a tick. */
function Strip({ level, low, high }: { level?: PacketLevel; low: string; high: string }) {
  if (!level || level.percentile == null) return null;
  return <div className="bf-strip" aria-hidden="true">
    <span className="bf-strip-track"><b style={{ left: "50%" }} /><i style={{ left: `${sizePct(level)}%` }} /></span>
    <span className="bf-strip-ends"><small>{low}</small><small>NJ median town</small><small>{high}</small></span>
  </div>;
}

type Figure = { value: string; label: string; versus?: string };
type Slide = {
  key: string; section: string; kicker: string; headline: string; why?: string; source?: string;
  figure?: Figure; standing?: Standing | null; body?: ReactNode; flagged?: boolean; plain?: boolean;
  /** Speaker notes: the full findings, limits and caveats the slide leaves out. */
  notes?: ReactNode;
};

/** A check in full, for the notes: what the figures say, and what they cannot. */
const noteOf = (c?: CheckItem) => c ? <div key={c.key}><b>{c.title}.</b> {c.finding}{c.flag ? ` ${c.flag}.` : ""} <i>{c.limitation}</i></div> : null;
const SECTIONS = ["Overview", "Cost", "Market", "Risk", "Living", "Next steps"];

function slidesFor(data: GuideData, rate: number, nj: Medians): Slide[] {
  const lv = (id: string) => data.levels.find((l) => l.metric_id === id);
  const name = data.region.name;
  const county = data.region.parent?.name ?? "";
  const sourceOf = (l?: PacketLevel) => {
    if (!l) return undefined;
    const s = data.sources.find((x) => x.source_id === l.source_id);
    // A rate this site works out (turnover) names the records it is worked out from.
    if (l.metric_id === "sr1a_turnover_per_1000") return `Worked out from NJ deed records (SR-1A), ${year(l.period_end)}`;
    return `Source: ${s?.publisher ?? s?.name ?? l.source_id}, ${year(l.period_end)}`;
  };
  const checks = checklist(data, { place: regionPath(data.region.region_id), tax: `/tax?town=${data.region.geoid}` });
  const check = (k: string) => checks.find((c) => c.key === k);
  const sale = lv("sr1a_median_sale_price"), zhvi = lv("zhvi_sfr");
  const price = sale ?? zhvi;
  const tax = lv("modiv_median_tax_bill"), turnover = lv("sr1a_turnover_per_1000"), sales = lv("sr1a_sales_count");
  const flood = lv("fema_flood_homes_share"), built = lv("modiv_median_year_built") ?? lv("acs_median_year_built");
  const commute = lv("acs_mean_commute_minutes"), income = lv("acs_median_hh_income");
  const month = affordAnswer(data, { income: 1, size: 3, ratePct: rate, personal: { downPct: 20 }, home: {}, prefer: "transactions" });
  const flagged = checks.filter((c) => c.flag);
  const riskKeys = ["flood", "claims", "sites", "water", "noise"];
  const risks = flagged.filter((c) => riskKeys.includes(c.key));
  const versus = (v: number | undefined, fmt: (n: number) => string) => (v == null ? undefined : `NJ median town: ${fmt(v)}`);

  // The three figures furthest from the median town, as tiles on the bottom-line slide.
  const tiles: { l?: PacketLevel; topic: string; value: (l: PacketLevel) => string; label: string; say: (l: PacketLevel) => string }[] = [
    { l: tax, topic: "taxes", value: (l) => usd(l.value), label: "typical tax bill a year", say: (l) => share(l, "Higher than", "Lower than") },
    { l: price, topic: "home prices", value: (l) => usd(l.value), label: "typical home price", say: (l) => share(l, "Higher than", "Lower than") },
    { l: commute, topic: "commutes", value: (l) => `${Math.round(l.value)} min`, label: "average commute", say: (l) => share(l, "Longer than", "Shorter than") },
    { l: flood, topic: "flood risk", value: (l) => pct(l.value), label: "of homes in FEMA’s high-risk flood zone", say: (l) => share(l, "More than", "Fewer than") },
    { l: built, topic: "the age of its homes", value: (l) => String(Math.round(l.value)), label: "year the typical home was built", say: (l) => share(l, "Newer than", "Older than") },
    { l: turnover, topic: "how often homes sell", value: (l) => `${Math.round(l.value)} per 1,000`, label: "homes sold each year", say: (l) => share(l, "More often than", "Less often than") },
  ];
  const top = tiles.filter((t) => t.l?.percentile != null).sort((a, b) => Math.abs(sizePct(b.l!) - 50) - Math.abs(sizePct(a.l!) - 50)).slice(0, 3);
  const bottomLine = top.map((t) => `${t.label[0].toUpperCase()}${t.label.slice(1)}: ${t.value(t.l!)}`);
  const asOf = [price, tax].filter(Boolean).map((l) => l!.period_end).sort().at(-1);

  const list = (items: (CheckItem | undefined)[]) => <ul className="bf-checks">{items.filter(Boolean).map((c) => <li key={c!.key} data-flag={Boolean(c!.flag)}><b>{c!.title}</b><span>{c!.flag ?? first(c!.finding)}</span></li>)}</ul>;

  return [
    { key: "title", notes: <p>Use the arrow keys to move, F for full screen, N to show or hide these notes. The same twelve slides appear for every town, in the same order, so briefings can be compared.</p>, section: "Overview", kicker: "Buyer’s briefing", plain: true,
      headline: `Buying in ${name}`,
      body: <div className="bf-title"><p>{county}{county ? ", " : ""}New Jersey</p><p>{SECTIONS.slice(1).join(" · ")}</p><p className="bf-title-date">Prepared {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}{asOf ? ` · figures to ${new Date(asOf).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}` : ""}</p></div> },
    { key: "bottom", notes: <p>The three figures shown are the ones furthest from New Jersey’s median town, among home price, tax bill, commute, flood risk, home age and how often homes sell. Furthest from the middle is not the same as most important for you; the slides that follow cover all of them.</p>, section: "Overview", kicker: "Bottom line",
      headline: `${name} stands out on ${top.map((t) => t.topic).join(", ").replace(/, ([^,]*)$/, " and $1")}`,
      why: "Everything that follows explains these three. If you stop here, you have the main points.",
      body: <div className="bf-tiles">{top.map((t) => <div key={t.label} className="bf-tile" data-mark={standing(t.l)?.mark}><b>{t.value(t.l!)}</b><span>{t.label}</span><small>{t.say(t.l!)}</small></div>)}</div> },
    { key: "price", notes: <><p>The recorded sale price is the median of homes that actually sold here in the last twelve months to the date shown, from New Jersey’s deed records (SR-1A); sales between relatives and other non-market transfers are set aside. Zillow’s estimate models every home, sold or not, so the two differ.</p>{lv("sr1a_price_lower_quartile") && lv("sr1a_price_upper_quartile") && <p>Half of recorded sales fell between {usd(lv("sr1a_price_lower_quartile")!.value)} and {usd(lv("sr1a_price_upper_quartile")!.value)}.</p>}</>, section: "Cost", kicker: "What homes cost", standing: standing(price), source: sourceOf(price),
      headline: price ? `Homes here cost ${share(price, "more than", "less than")}` : "No home price is published here",
      figure: price ? { value: usd(price.value), label: sale ? "median recorded sale price" : "Zillow’s typical home value", versus: versus(nj.sr1a_median_sale_price, usd) } : undefined,
      why: "Price sets the loan, the down payment and much of the tax bill.",
      body: <><Strip level={price} low="Least expensive" high="Most expensive" />{sale && zhvi && <p className="bf-note">Zillow’s estimate for the typical home is {usd(zhvi.value)}. Sales count only homes that changed hands.</p>}</> },
    { key: "month", notes: month ? <><p>{month.month.lines.filter((l) => (l.value ?? 0) > 0).map((l) => `${l.label} ${usd(l.value!)}`).join("; ")}.</p><p>A 30-year fixed loan at {rate.toFixed(2)}%, the national average, with 20% down on the price shown. Upkeep is a rule of thumb. {month.month.optional.length ? `Not counted unless they apply: ${month.month.optional.join(", ")}.` : ""} {month.month.missing.length ? `No figure for: ${month.month.missing.join(", ")}.` : ""} The income line uses HUD’s 30% cost-burden line; it is a comparison, not what a lender will approve.</p><p>To use your own income, down payment or a listing’s price, or to weigh renting against buying: <a href={`/guide/numbers?place=${data.region.region_id}`}>your own numbers</a>.</p></> : undefined, section: "Cost", kicker: "What it costs each month", source: `Worked out from published price, tax and insurance figures, at ${rate.toFixed(2)}%`,
      headline: month ? `Owning the typical home takes about ${usd(month.month.total)} a month` : "No monthly cost can be worked out here",
      figure: month ? { value: usd(month.month.total), label: `a month, 20% down on ${month.price.basis === "index" ? "Zillow’s typical home value" : "the median sale price"}, ${usd(month.price.value)}`, versus: `Income to keep it at 30%: about ${usd(Math.ceil(incomeFor(month.month.total) / 1000) * 1000)} a year` } : undefined,
      why: "This is the number your budget has to carry, before any other spending.",
      body: month ? (() => {
        // The bar carries no text, so a thin part never truncates; the parts are listed below it.
        const parts = month.month.lines.filter((l) => (l.value ?? 0) > 0);
        const short = (l: { key: string; label: string }) => ({ mortgage: "Mortgage", principal_interest: "Mortgage", tax: "Property tax", insurance: "Insurance", utilities: "Utilities", upkeep: "Upkeep", mi: "Mortgage insurance", hoa: "HOA fees", flood: "Flood insurance" } as Record<string, string>)[l.key] ?? l.label.split(",")[0];
        return <><div className="bf-stack" role="img" aria-label={parts.map((l) => `${short(l)} ${usd(l.value!)}`).join(", ")}>{parts.map((l, n) => <span key={l.key} data-part={n} style={{ flex: l.value! }} />)}</div>
          <ul className="bf-parts">{parts.map((l, n) => <li key={l.key}><i data-part={n} aria-hidden="true" /><span>{short(l)}</span><b>{usd(l.value!)}</b><small>{Math.round((l.value! / month.month.total) * 100)}%</small></li>)}</ul>
          <p className="bf-note">Not loan approval. HOA fees and flood insurance not included.</p></>;
      })() : null },
    { key: "tax", notes: noteOf(check("tax")), section: "Cost", kicker: "Property taxes", standing: standing(tax), source: sourceOf(tax), flagged: Boolean(check("tax")?.flag),
      headline: tax ? (highest(tax) <= 50 ? `Taxes here are the ${ordinal(highest(tax))} highest of ${tax.of} NJ towns` : `Taxes here are ${share(tax, "higher than", "lower than")}`) : "No tax bill is published here",
      figure: tax ? { value: usd(tax.value), label: "typical tax bill a year", versus: versus(nj.modiv_median_tax_bill, usd) } : undefined,
      why: "In New Jersey the tax bill is often the largest cost after the mortgage, and it rises with the town’s budget.",
      body: <><Strip level={tax} low="Lowest bills" high="Highest bills" />{check("tax")?.flag && <p className="bf-flag">{check("tax")!.flag}</p>}</> },
    { key: "market", notes: noteOf(check("turnover")), section: "Market", kicker: "The market", standing: standing(turnover), source: sourceOf(turnover),
      headline: turnover ? (standing(turnover)?.mark === "typical" ? "Homes here sell at a typical pace for NJ" : `Homes here change hands ${share(turnover, "more often than", "less often than")}`) : "Sales are not published here",
      figure: turnover ? { value: `${Math.round(turnover.value)}`, label: "of every 1,000 homes sell each year", versus: versus(nj.sr1a_turnover_per_1000, (n) => `${Math.round(n)}`) } : undefined,
      why: "A slow market means fewer homes to choose from, and a home that may take longer to sell later.",
      body: <><Strip level={turnover} low="Rarely sell" high="Often sell" />{sales && <p className="bf-note">{Math.round(sales.value)} homes sold in the latest year.</p>}</> },
    { key: "risk", notes: <>{riskKeys.map((k) => noteOf(check(k)))}{noteOf(check("radon"))}</>, section: "Risk", kicker: "Risks to the house", flagged: risks.length > 0, source: "Sources: FEMA, NJDEP, EPA, BTS",
      headline: risks.length ? `${risks.length === 1 ? "One risk" : `${risks.length} risks`} here ${risks.length === 1 ? "is" : "are"} worth checking: ${risks.map((c) => c.title.toLowerCase()).join(" and ")}` : "No risk here passes the lines we mark",
      why: "These follow the house: insurance, health and resale depend on them. Test every home for radon.",
      body: list(riskKeys.map(check)) },
    { key: "homes", notes: noteOf(check("age")), section: "Risk", kicker: "The homes themselves", standing: standing(built), source: sourceOf(built), flagged: Boolean(check("age")?.flag),
      headline: built ? (check("age")?.flag ? "Most homes here predate the 1978 lead-paint ban" : `Homes here are ${share(built, "newer than", "older than")}`) : "Home ages are not published here",
      figure: built ? { value: String(Math.round(built.value)), label: "year the typical home was built", versus: versus(nj.modiv_median_year_built, (n) => String(Math.round(n))) } : undefined,
      why: "Older homes can mean lead paint, old wiring and bigger repairs. Budget for an inspection.",
      body: <Strip level={built} low="Oldest" high="Newest" /> },
    { key: "living", notes: <>{["commute", "school", "broadband", "utilities"].map((k) => noteOf(check(k)))}</>, section: "Living", kicker: "Living there", standing: standing(commute), source: sourceOf(commute),
      headline: commute ? `Commutes here are ${share(commute, "longer than", "shorter than")}` : "Daily life, in figures",
      figure: commute ? { value: `${Math.round(commute.value)} min`, label: "average commute each way", versus: versus(nj.acs_mean_commute_minutes, (n) => `${Math.round(n)} min`) } : undefined,
      why: "You live with the commute, the schools and the connection every day.",
      body: list(["school", "broadband"].map(check)) },
    { key: "next", notes: <>{(flagged.length ? flagged : checks.slice(0, 3)).map((c) => <div key={c.key}><b>{c.title}:</b> {c.steps.map((st) => st.label).join("; ")}.</div>)}</>, section: "Next steps", kicker: "What to do next",
      headline: flagged.length ? `Before an offer: ${flagged.length} things to ask about` : "Before an offer: the usual steps",
      why: "Each comes from a slide above. None needs the site; each needs a call or a document.",
      body: <ol className="bf-next">{(flagged.length ? flagged : checks.slice(0, 3)).map((c) => { const s = c.steps[0]; return <li key={c.key}><b>{c.title}</b>{s && <a href={s.href} target={s.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{s.label} ↗</a>}</li>; })}</ol> },
    { key: "summary", section: "Next steps", kicker: "Summary", plain: true,
      headline: `${name} in one slide`,
      body: <div className="bf-summary"><div className="bf-tiles bf-tiles-small">{top.map((t) => <div key={t.label} className="bf-tile"><b>{t.value(t.l!)}</b><span>{t.label}</span></div>)}</div><p><b>Monthly cost:</b> {month ? `about ${usd(month.month.total)}` : "not available"}. <b>Worth checking:</b> {flagged.length ? flagged.map((c) => c.title.toLowerCase()).join(", ") : "nothing past our lines"}.</p><p className="bf-note">{bottomLine.join(" · ")}</p></div> },
    { key: "sources", notes: <ul>{data.sources.map((x) => <li key={x.source_id}>{x.name} — {x.publisher}. {x.license}.</li>)}</ul>, section: "Next steps", kicker: "Sources", plain: true,
      headline: "Where every figure came from",
      body: <><p className="bf-note">{income ? `For scale: the median household here earns ${usd(income.value)} a year. ` : ""}All figures and dates are on <Link href={regionPath(data.region.region_id)}>{name}’s page</Link>; your own income or a listing’s price go in the <Link href={`/guide/numbers?place=${data.region.region_id}`}>calculator</Link>. Computed by fixed rules from public data; not written by AI.</p>
        <ul className="bf-sources">{[...new Set(data.sources.map((s) => s.publisher ?? s.name))].slice(0, 18).map((n) => <li key={n}>{n}</li>)}</ul></> },
  ];
}

export function Briefing({ artifactUrl, rate, newest }: { artifactUrl: string; rate: number; newest: Record<string, string | null> }) {
  const [entries, setEntries] = useState<SearchEntry[]>([]);
  const [placeId, setPlaceId] = useState<number | null>(null);
  const [data, setData] = useState<GuideData | null>(null);
  const [nj, setNj] = useState<Medians>({});
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  const [i, setI] = useState(0);
  const [text, setText] = useState("");
  const [notes, setNotes] = useState(false);
  const [full, setFull] = useState(false);
  const deck = useRef<HTMLElement>(null);
  // Presentation mode covers the window itself, and also asks the browser for true full
  // screen where it allows it (an embedded or locked-down browser may refuse silently).
  const fullNow = useRef(false);
  const toggleFull = useCallback(() => {
    const on = !fullNow.current;
    fullNow.current = on;
    setFull(on);
    if (on) void document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);
  useEffect(() => {
    const change = () => { if (!document.fullscreenElement) { fullNow.current = false; setFull(false); } };
    document.addEventListener("fullscreenchange", change); return () => document.removeEventListener("fullscreenchange", change);
  }, []);
  useEffect(() => {
    document.documentElement.style.overflow = full ? "hidden" : "";
    return () => { document.documentElement.style.overflow = ""; };
  }, [full]);

  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("place"));
    if (id > 0) setPlaceId(id);
    fetch("/search.json").then((r) => r.json()).then((list: SearchEntry[]) => setEntries(list.filter((e) => e.level === "municipality"))).catch(() => {});
    njMedians(artifactUrl).then(setNj);
  }, [artifactUrl]);
  useEffect(() => {
    if (placeId === null) return;
    setState("loading"); setI(0);
    loadPlace(artifactUrl, placeId, newest).then((d) => { setData(d); setState(d ? "idle" : "failed"); });
    const url = new URL(window.location.href); url.searchParams.set("place", String(placeId)); window.history.replaceState(null, "", url);
  }, [artifactUrl, placeId, newest]);

  const slides = useMemo(() => (data ? slidesFor(data, rate, nj) : []), [data, rate, nj]);
  const go = useCallback((n: number) => setI((cur) => Math.max(0, Math.min(slides.length - 1, cur + n))), [slides.length]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === "INPUT") return; if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); go(1); } if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1); if (e.key === "f" || e.key === "F") toggleFull(); if (e.key === "Escape") { fullNow.current = false; setFull(false); } if (e.key === "n" || e.key === "N") setNotes((v) => !v); };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [go, toggleFull]);

  const q = text.trim().toLowerCase();
  const suggestions = q ? entries.filter((e) => e.name.toLowerCase().startsWith(q)).slice(0, 6) : [];
  const s = slides[i];

  if (!data) return <section className="bf-start">
    <h2>Get briefed on a town</h2>
    <p>Twelve slides, the same for every New Jersey town. Bottom line first.</p>
    <div className="bf-pick">
      <input value={text} placeholder={state === "loading" ? "Preparing the briefing…" : "Search a town, e.g. Princeton"} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && suggestions[0]) setPlaceId(suggestions[0].id); }} />
      {suggestions.length > 0 && <ul>{suggestions.map((e) => <li key={e.id}><button type="button" onClick={() => setPlaceId(e.id)}><b>{e.name}</b><small>{e.detail}</small></button></li>)}</ul>}
    </div>
    {state === "failed" && <p role="alert">That town’s figures could not be loaded.</p>}
  </section>;

  return <section ref={deck} className="bf-deck" data-full={full} data-notes={notes} aria-roledescription="slideshow" aria-label={`Briefing: ${data.region.name}`}>
    <header className="bf-top">
      <span><b>{data.region.name}</b> briefing</span>
      <button type="button" className="bf-change" onClick={() => { setData(null); setPlaceId(null); setText(""); }}>Change town</button>
    </header>
    <ol className="bf-progress" aria-label="Slides" style={{ gridTemplateColumns: `repeat(${slides.length}, 1fr)` }}>{slides.map((x, n) => <li key={x.key}><button type="button" aria-current={n === i ? "step" : undefined} data-flag={x.flagged} onClick={() => setI(n)} title={x.kicker}><span className="visually-hidden">{x.kicker}</span></button></li>)}</ol>
    <div className="bf-frame">
    <article className="bf-slide" data-plain={s.plain} key={s.key} aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}: ${s.kicker}`}>
      <nav className="bf-sections" aria-hidden="true">{SECTIONS.map((x) => <span key={x} data-on={x === s.section}>{x}</span>)}</nav>
      <p className="bf-kicker">{s.kicker}{s.flagged && <em>Worth a closer look</em>}</p>
      <h2 className="bf-headline">{s.headline}</h2>
      <div className="bf-main">
        {s.figure && <div className="bf-figure"><b>{s.figure.value}</b><span>{s.figure.label}</span>{s.standing && <small className="bf-standing" data-mark={s.standing.mark}>{s.standing.words}</small>}{s.figure.versus && <small className="bf-versus">{s.figure.versus}</small>}</div>}
        <div className="bf-body">{s.body}</div>
      </div>
      {s.why && <p className="bf-why"><b>Why it matters</b>{s.why}</p>}
      <footer className="bf-foot"><span>{s.source ?? ""}</span><span>{data.region.name} · {i + 1} / {slides.length}</span></footer>
    </article>
    </div>
    <nav className="bf-nav">
      <button type="button" onClick={() => go(-1)} disabled={i === 0}>← Previous</button>
      <span className="bf-tools">
        <button type="button" className="bf-tool" aria-pressed={notes} onClick={() => setNotes(!notes)} title="Speaker notes (N)">Notes</button>
        <button type="button" className="bf-tool" aria-pressed={full} onClick={toggleFull} title="Full screen (F)">{full ? "Exit full screen" : "Full screen"}</button>
        <span>{i + 1} / {slides.length}</span>
      </span>
      <button type="button" className="bf-next-button" onClick={() => go(1)} disabled={i === slides.length - 1}>{i === slides.length - 1 ? "End" : `Next: ${slides[i + 1].kicker} →`}</button>
    </nav>
    {notes && <aside className="bf-notes" aria-label="Speaker notes"><b>Notes · {s.kicker}</b>{s.notes ?? <p>No notes for this slide.</p>}</aside>}
  </section>;
}

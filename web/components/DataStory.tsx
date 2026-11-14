"use client";

/**
 * MOCK (2026-11-13): "How the data is built" as one page, for a reader who has no idea of
 * the project's size. In place of the Data explorer's six tabs: the scale in plain words;
 * one real figure followed through the six steps; a map of how much each town holds; how
 * far back each source reaches; the latest updates; the kinds of numbers; and a dictionary
 * that can be read by the questions people ask. Schema, profiling and the ERD leave the page.
 */

import { useMemo, useState } from "react";
import styles from "./DataStory.module.css";
import type { Catalog, CatalogMetric } from "@/lib/dataCatalog";
import { KIND_LABELS, KIND_MEANINGS, type RecordType } from "@/lib/kinds";
import { TERMS_BY_ID } from "@/lib/terms";

export type Coverage = { width: number; height: number; towns: { d: string; n: number; name: string }[]; split: { zillowTowns: number; zillow: number; other: number } };
export type Example = { place: string; value: number; year: string; rank: number | null; of: number | null; source: string; fetched: string | null; parcels: number | null; model: string | null; metric: string; href: string };
export type Update = { name: string; publisher: string; at: string; next: string | null };

const n = (v: number) => v.toLocaleString("en-US");
const roughly = (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)} million` : n(v);
const year = (d: string | null) => d?.slice(0, 4) ?? "–";
const usd = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const ordinal = (k: number) => `${k}${[11, 12, 13].includes(k % 100) ? "th" : ["th", "st", "nd", "rd"][k % 10] ?? "th"}`;
const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const self = (publisher?: string) => !publisher || publisher.startsWith("Housing Intelligence");

// Counted or set first, then estimated: the site's solid and dashed labels (acts.module.css .chip).
const KIND_ORDER: RecordType[] = ["administrative", "determination", "benchmark", "survey", "modelled", "calculated"];
const ESTIMATED = new Set<string>(["survey", "modelled", "calculated"]);

/** The questions a resident asks, and the figures that answer each (hand-picked for the mock). */
const QUESTIONS: { q: string; ids: string[] }[] = [
  { q: "Can I afford it?", ids: ["sr1a_median_sale_price", "zhvi_sfr", "zori_all", "acs_median_gross_rent", "price_to_income", "rent_to_income", "acs_median_hh_income"] },
  { q: "What will I pay in tax?", ids: ["modiv_median_tax_bill", "nj_effective_tax_rate", "nj_general_tax_rate", "modiv_median_assessed_value", "nj_revaluation_year"] },
  { q: "Will it flood?", ids: ["fema_flood_homes_share", "fema_flood_claims", "fema_flood_claims_paid", "njdep_tidal_homes_share", "elevation_low_homes_share"] },
  { q: "How would I get to work?", ids: ["acs_mean_commute_minutes", "transit_rail_homes_share", "acs_commute_transit_share", "acs_work_from_home_share", "lodes_work_nyc_share", "acs_no_vehicle_share"] },
  { q: "Are homes selling?", ids: ["sr1a_turnover_per_1000", "sr1a_sales_count", "realtor_median_days_on_market", "realtor_active_listings", "permits_total_units", "nj_net_units_per_1000"] },
  { q: "What are the homes like?", ids: ["modiv_median_year_built", "acs_share_3plus_bedrooms", "acs_share_detached", "msft_median_footprint_sqft", "modiv_median_lot_acres", "acs_heat_oil_share"] },
  { q: "What's it like day to day?", ids: ["noise_homes_share_55db", "tree_canopy_homes_share", "lights_homes_radiance", "water_homes_share_violation", "nclimgrid_days_over_90", "overture_diner_count"] },
  { q: "Who lives there?", ids: ["acs_population", "acs_median_hh_income", "acs_with_children_share", "acs_living_alone_share", "irs_net_migration_per_1000", "acs_avg_household_size"] },
];

/** 1. One real figure through the six steps. */
function FollowOne({ e, tests }: { e: Example; tests: number }) {
  const steps: [string, string, string][] = [
    ["Fetch", e.fetched ? day(e.fetched) : "MOD-IV", "the state's tax records, downloaded"],
    ["Keep", "As is", "the original file, stored untouched"],
    ["Clean", e.parcels ? n(e.parcels) : "–", `homes matched to ${e.place}`],
    ["Check", n(tests), "automated tests"],
    ["Combine", e.rank ? ordinal(e.rank) : "–", `highest of ${e.of ? n(e.of) : ""} towns`],
    ["Publish", usd(e.value), `typical tax bill, ${e.year}`],
  ];
  return <section className={styles.section} aria-labelledby="ds-follow">
    <h2 id="ds-follow">Follow one number: {e.place}&rsquo;s tax bill</h2>
    <ol className={styles.follow}>{steps.map(([name, big, small], i) => <li key={name}>
      <b><i>{i + 1}</i>{name}</b><strong>{big}</strong><span>{small}</span>
    </li>)}</ol>
    <p className={styles.tiny}><a href={e.href}>See it on {e.place}&rsquo;s page →</a></p>
  </section>;
}

/** 2. Every town, shaded by how many values it holds. */
function CoverageMap({ c }: { c: Coverage }) {
  const sorted = c.towns.map((t) => t.n).sort((a, b) => a - b);
  const at = (f: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * f))];
  // Four bands at the quartiles, so each holds about a quarter of the towns.
  const bands = [at(0.25), at(0.5), at(0.75), sorted.at(-1)!];
  const level = (v: number) => Math.max(0, bands.findIndex((b) => v <= b));
  const [hover, setHover] = useState<{ name: string; n: number } | null>(null);
  return <section className={styles.section} aria-labelledby="ds-map">
    <h2 id="ds-map">Every town, covered</h2>
    <p className={styles.sub}>Values held per town. Towns Zillow tracks ({n(c.split.zillowTowns)}) hold about {n(c.split.zillow)}; the rest about {n(c.split.other)}.</p>
    <div className={styles.mapWrap}>
      <svg className={styles.map} viewBox={`0 0 ${c.width} ${c.height}`} role="img" aria-label={`Map of New Jersey's ${c.towns.length} towns by how many values each holds, from ${sorted[0]} to ${sorted.at(-1)}.`} onMouseLeave={() => setHover(null)}>
        {c.towns.map((t, i) => <path key={i} d={t.d} fillOpacity={0.15 + level(t.n) * 0.25} onMouseEnter={() => setHover(t)} />)}
      </svg>
      <div className={styles.mapSide}>
        <p className={styles.mapHover} aria-live="polite">{hover ? <><b>{hover.name}</b>{n(hover.n)} values</> : <span>Point at a town</span>}</p>
        <ul className={styles.legend}>{bands.map((b, i) => <li key={i}><i style={{ opacity: 0.15 + i * 0.25 }} />{i === 0 ? `${n(sorted[0])}–${n(b)}` : `${n(bands[i - 1] + 1)}–${n(b)}`} values</li>)}</ul>
      </div>
    </div>
  </section>;
}

/** 3. How far back each source reaches. */
function Timeline({ catalog }: { catalog: Catalog }) {
  // One line per publisher: its earliest figure to its latest, across all its sources.
  const span = new Map<string, { name: string; from: number; to: number; sources: number }>();
  for (const s of catalog.sources) {
    const ms = catalog.metrics.filter((m) => m.source === s.id && m.first && m.last);
    if (!ms.length) continue;
    const from = Number(ms.map((m) => m.first!).sort()[0].slice(0, 4)), to = Number(ms.map((m) => m.last!).sort().at(-1)!.slice(0, 4));
    const name = self(s.publisher) ? "Worked out by this site" : s.publisher;
    const was = span.get(name);
    span.set(name, was ? { name, from: Math.min(was.from, from), to: Math.max(was.to, to), sources: was.sources + 1 } : { name, from, to, sources: 1 });
  }
  const rows = [...span.values()].sort((a, b) => a.from - b.from || b.to - a.to);
  const start = Math.floor(Math.min(...rows.map((r) => r.from)) / 10) * 10, end = new Date().getFullYear() + 1;
  const x = (y: number) => `${((y - start) / (end - start)) * 100}%`;
  const ticks = Array.from({ length: Math.floor((end - start) / 10) + 1 }, (_, i) => start + i * 10);
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, 18);
  return <section className={styles.section} aria-labelledby="ds-time">
    <h2 id="ds-time">How far back it goes</h2>
    <div className={styles.timeline}>
      <div className={styles.axis} aria-hidden="true">{ticks.map((t) => <span key={t} style={{ left: x(t) }}>{t}</span>)}</div>
      <ul>{shown.map((r) => <li key={r.name} title={`${r.name}: ${r.from}–${r.to}, ${r.sources} ${r.sources === 1 ? "source" : "sources"}`}>
        <span className={styles.tlName}>{r.name}<small>{r.from === r.to ? r.from : `${r.from}–${r.to}`}</small></span>
        <span className={styles.tlTrack}><i style={{ left: x(r.from), width: `max(6px, calc(${x(r.to + 1)} - ${x(r.from)}))` }} /></span>
      </li>)}</ul>
    </div>
    {rows.length > shown.length && <button type="button" className={styles.more} onClick={() => setAll(true)}>Show all {rows.length} publishers</button>}
  </section>;
}

/** 4. What arrived most recently, and what is due next. */
function Updates({ updates }: { updates: Update[] }) {
  return <section className={styles.section} aria-labelledby="ds-new">
    <h2 id="ds-new">Latest updates</h2>
    <p className={styles.sub}><a href="/freshness">Full schedule →</a></p>
    <ul className={styles.updates}>{updates.map((u) => <li key={u.name}><time>{day(u.at)}</time><b>{u.publisher}</b>{u.next && <small>Next: {u.next}</small>}</li>)}</ul>
  </section>;
}

export function DataStory({ catalog, places, coverage, example, updates }: { catalog: Catalog; places: { towns: number; counties: number; zips: number }; coverage: Coverage | null; example: Example | null; updates: Update[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<string>("all");
  const [topic, setTopic] = useState<number | null>(null);
  const [limit, setLimit] = useState(25);
  const sources = new Map(catalog.sources.map((s) => [s.id, s]));
  const label = new Map(catalog.metrics.map((m) => [m.id, m.label]));
  const values = catalog.metrics.reduce((sum, m) => sum + (m.observations ?? 0), 0);
  const tests = catalog.models.reduce((sum, m) => sum + m.tests, 0);
  const firstYear = catalog.metrics.map((m) => m.first).filter(Boolean).sort()[0];
  const publishers = useMemo(() => {
    const count = new Map<string, number>();
    // The site's own calculations are not a publisher.
    for (const m of catalog.metrics) { const p = sources.get(m.source)?.publisher; if (p && !self(p)) count.set(p, (count.get(p) ?? 0) + 1); }
    return [...count].sort((a, b) => b[1] - a[1]);
  }, [catalog]); // eslint-disable-line react-hooks/exhaustive-deps
  const kinds = KIND_ORDER.map((k) => [k, catalog.metrics.filter((m) => m.kind === k).length] as const).filter(([, c]) => c > 0);
  const toDictionary = () => document.getElementById("ds-dictionary")?.scrollIntoView({ behavior: "smooth" });

  const q = query.trim().toLowerCase();
  const asked = topic === null ? null : QUESTIONS[topic].ids;
  const shown = catalog.metrics
    .filter((m) => m.observations && (kind === "all" || m.kind === kind) && (!asked || asked.includes(m.id)))
    .filter((m) => !q || [m.label, m.description, TERMS_BY_ID[m.id]?.what, sources.get(m.source)?.name, sources.get(m.source)?.publisher].some((t) => t?.toLowerCase().includes(q)))
    .sort((a, b) => asked ? asked.indexOf(a.id) - asked.indexOf(b.id) : a.label.localeCompare(b.label));
  const stepsOf = (m: CatalogMetric) => catalog.models.filter((x) => x.metrics.includes(m.id));

  return <div className={styles.page}>
    <header className={styles.hero}>
      <p className={styles.kicker}>How the data is built</p>
      <h1>{roughly(values)} public numbers, about every place in New Jersey</h1>
      <dl className={styles.scale}>
        <div><dt>public sources</dt><dd>{n(catalog.sources.length)}</dd><small>from {publishers.length} publishers</small></div>
        <div><dt>kinds of figures</dt><dd>{n(catalog.metrics.length)}</dd><small>prices, taxes, schools, floods…</small></div>
        <div><dt>places</dt><dd>{n(places.towns + places.counties + places.zips)}</dd><small>{n(places.towns)} towns, {n(places.counties)} counties, {n(places.zips)} ZIP codes</small></div>
        <div><dt>reaching back to</dt><dd>{year(firstYear ?? null)}</dd><small>and updated as each source releases</small></div>
      </dl>
    </header>

    {example && <FollowOne e={example} tests={tests} />}
    {coverage && <CoverageMap c={coverage} />}
    <Timeline catalog={catalog} />

    <section className={styles.section} aria-labelledby="ds-who">
      <h2 id="ds-who">Who it comes from</h2>
      <ul className={styles.bars}>{publishers.slice(0, 12).map(([p, c]) => <li key={p}><span>{p}</span><i style={{ width: `${(c / publishers[0][1]) * 100}%` }} /><b>{c}</b></li>)}</ul>
      <p className={styles.tiny}>Figures per publisher · <a href="/sources">all {publishers.length} publishers and their terms →</a></p>
    </section>

    {updates.length > 0 && <Updates updates={updates} />}

    <section className={styles.section} aria-labelledby="ds-kinds">
      <h2 id="ds-kinds">Six kinds of numbers</h2>
      <div className={styles.stackKey} aria-hidden="true"><span style={{ flexGrow: kinds.filter(([k]) => !ESTIMATED.has(k)).reduce((t, [, c]) => t + c, 0) }}>Counted or set</span><span style={{ flexGrow: kinds.filter(([k]) => ESTIMATED.has(k)).reduce((t, [, c]) => t + c, 0) }}>Estimated</span></div>
      <div className={styles.stack} aria-hidden="true">{kinds.map(([k, c]) => <i key={k} data-est={ESTIMATED.has(k)} data-on={kind === k || kind === "all"} style={{ flexGrow: c }} />)}</div>
      <ul className={styles.kinds}>{kinds.map(([k, c]) => <li key={k}><button type="button" aria-pressed={kind === k} title={KIND_MEANINGS[k]} onClick={() => { setKind(kind === k ? "all" : k); setLimit(25); toDictionary(); }}>
        <i data-est={ESTIMATED.has(k)} /><b>{KIND_LABELS[k]}</b><small>{c}</small></button></li>)}</ul>
    </section>

    <section className={styles.section} aria-labelledby="ds-dictionary">
      <h2 id="ds-dictionary">Every figure, explained</h2>
      <ul className={styles.questions}>{QUESTIONS.map((x, i) => <li key={x.q}><button type="button" aria-pressed={topic === i} onClick={() => { setTopic(topic === i ? null : i); setLimit(25); }}>{x.q}</button></li>)}</ul>
      <div className={styles.controls}>
        <label>Search<input type="search" value={query} placeholder="e.g. flood, rent, schools" onChange={(e) => { setQuery(e.target.value); setLimit(25); }} /></label>
        <label>Kind<select value={kind} onChange={(e) => { setKind(e.target.value); setLimit(25); }}>
          <option value="all">All kinds</option>{kinds.map(([k]) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
        </select></label>
      </div>
      <p className={styles.count} role="status">{shown.length} figures{topic !== null ? ` that help answer “${QUESTIONS[topic].q}”` : ""}</p>
      <div>{shown.slice(0, limit).map((m) => {
        const term = TERMS_BY_ID[m.id];
        const src = sources.get(m.source);
        const steps = stepsOf(m);
        return <details key={m.id} className={styles.entry}>
          <summary><strong>{m.label}</strong><span>{self(src?.publisher) ? "Calculated here" : src!.publisher} · {year(m.first)}–{year(m.last)}</span></summary>
          <div className={styles.body}>
            <p>{term?.what ?? m.description}</p>{term?.why && <p className={styles.why}>{term.why}</p>}
            <dl>
              <div><dt>Kind</dt><dd>{KIND_LABELS[m.kind as RecordType] ?? m.kind}</dd></div>
              <div><dt>Places</dt><dd>{n(m.places)}</dd></div>
              <div><dt>Years</dt><dd>{year(m.first)} to {year(m.last)}</dd></div>
              <div><dt>Updated</dt><dd>{m.frequency}</dd></div>
              <div><dt>Values</dt><dd>{n(m.observations)}</dd></div>
            </dl>
            <ol className={styles.path} aria-label="Where it comes from">
              {m.inputs.length
                ? <li><b>Worked out here from</b> {m.inputs.map((id) => label.get(id) ?? id).join(", ")}</li>
                : <li><b>Published by</b> {src ? <a href={src.homepage} target="_blank" rel="noreferrer noopener">{src.name}</a> : m.source}{src?.cadence ? `, ${src.cadence}` : ""}</li>}
              {steps.length > 0 && <li><b>Cleaned and checked in</b> {steps.length} {steps.length === 1 ? "step" : "steps"} <code>{steps.map((s) => s.name).join(" → ")}</code></li>}
              <li><b>Shown as</b> <code>{m.id}</code></li>
            </ol>
          </div>
        </details>;
      })}</div>
      {shown.length > limit && <button type="button" className={styles.more} onClick={() => setLimit(shown.length)}>Show all {shown.length}</button>}
    </section>

  </div>;
}

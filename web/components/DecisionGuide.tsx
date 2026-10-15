"use client";

import { regionPath } from "@/lib/placeRoutes";
import Link from "next/link";
import { useEffect, useState } from "react";

import { InquiryNote } from "@/components/InquiryNote";
import { PlacePicker } from "@/components/PlacePicker";
import type { CommunityContext, Observation, Packet, Utilities, WaterSystems } from "@/lib/api";
import { DOWN_PAYMENTS } from "@/lib/cost";
import { parseAmount, type Personal, readPersonal, writePersonal } from "@/lib/costScenario";
import { type Judged, STRENGTH_LABEL } from "@/lib/evidence";
import { formatValue } from "@/lib/format";
import {
  affordAnswer,
  BAND_TEXT,
  checklist,
  citation,
  type CheckItem,
  type GuideData,
  type GuideHome,
  MAX_YEARS,
  rentOrBuy,
} from "@/lib/guide";
import { readHousehold, writeHousehold } from "@/lib/household";
import type { IncomeLimits } from "@/lib/household";
import type { SearchEntry } from "@/lib/search";
import { cashFit } from "@/lib/budgetScenario";
import { ForYourHousehold } from "@/components/ForYourHousehold";
import { readGuideTransfer } from "@/lib/guideTransfer";
import { TwoPaths } from "@/components/TwoPaths";

/**
 * The decision guides (Milestone 49): one page for every place, which reads the place's
 * published files in the browser — the way the tax lookup reads parcels — rather than
 * one page per place, which would add about 7,000 files to a static host capped at
 * 20,000 (ARCHITECTURE #330). `?place=<region id>` names the place, so a region page can
 * link straight to its guide.
 */

type Load = { state: "idle" } | { state: "loading" } | { state: "failed" } | { state: "ready"; data: GuideData };

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

async function loadPlace(artifactUrl: string, id: number, newest: Record<string, string | null>): Promise<GuideData | null> {
  const base = `${artifactUrl}/regions/${id}`;
  const [packet, metrics, incomeLimits, water, community, utilities] = await Promise.all([
    getJson<Packet>(`${base}/packet/5y.json`),
    getJson<{ observations: Observation[] }>(`${base}/metrics.json`),
    getJson<IncomeLimits>(`${base}/income-limits.json`),
    getJson<WaterSystems>(`${base}/water-systems.json`),
    getJson<CommunityContext>(`${base}/community.json`),
    getJson<Utilities>(`${base}/utilities.json`),
  ]);
  if (!packet) return null;
  // FHA's limit and the county's turnover are the county's: a town or ZIP reads its
  // county's packet, the county HUD's income limits were set for.
  const countyId =
    packet.region.level === "county"
      ? null
      : (incomeLimits?.county_id ?? (packet.region.parent?.level === "county" ? packet.region.parent.region_id : null));
  const county = countyId ? await getJson<Packet>(`${artifactUrl}/regions/${countyId}/packet/5y.json`) : null;
  return {
    region: packet.region,
    levels: packet.levels,
    countyLevels: county?.levels ?? [],
    sources: packet.sources,
    incomeLimits,
    turnover: (metrics?.observations ?? [])
      .filter((o) => o.metric_id === "sr1a_turnover_per_1000")
      .sort((a, b) => a.period_start.localeCompare(b.period_start)),
    water,
    community,
    utilities,
    newest,
  };
}

function Strength({ judged }: { judged: Judged | null }) {
  if (!judged) {
    return <span className="evidence" data-strength="none">No local figure</span>;
  }
  return (
    <details className="evidence" data-strength={judged.strength}>
      <summary>{STRENGTH_LABEL[judged.strength]}</summary>
      {judged.reasons.length ? (
        <ul>{judged.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
      ) : (
        <p>For this exact place, from the newest edition its source has published, with no wide margin or thin sample.</p>
      )}
      <p className="evidence-rule">Set by fixed rules: geography, edition, survey margin and sample size. Not a judgement.</p>
    </details>
  );
}

function Steps({ steps }: { steps: { label: string; href: string }[] }) {
  if (!steps.length) return null;
  return (
    <ul className="guide-steps">
      {steps.map((step) =>
        step.href.startsWith("/") || step.href.startsWith("#") ? (
          <li key={`${step.label} ${step.href}`}><Link href={step.href}>{step.label}</Link></li>
        ) : (
          <li key={`${step.label} ${step.href}`}><a href={step.href} target="_blank" rel="noreferrer">{step.label} ↗</a></li>
        ),
      )}
    </ul>
  );
}

function Check({ item }: { item: CheckItem }) {
  return (
    <li className="guide-check" id={`guide-check-${item.key}`}>
      <details className="guide-tile">
        <summary>
          <h3>{item.title}</h3>
          <p>{item.finding}</p>
        </summary>
        <Steps steps={item.steps} />
        <div className="guide-check-evidence">
          <Strength judged={item.evidence} />
          <p className="guide-limit">{item.limitation}</p>
          {item.source && <small className="src">Source: {item.source}</small>}
          {item.inquiry && <InquiryNote inquiry={item.inquiry} headline="NJDEP is building a new, town-level radon map" />}
        </div>
      </details>
    </li>
  );
}

// The one-line verdict each answer opens with (2026-10-15).
const AFFORD_VERDICT = { within: "Within reach", burdened: "A stretch", severe: "Out of reach" } as const;

const usd = (value: number) => formatValue(value, "usd");

// Places to start from when the reader has none in mind: towns and counties from the
// state's north, centre and shore. Matched by name, so a renumbered id cannot break them.
const GUIDE_EXAMPLES = [["Hoboken", "municipality"], ["Montclair", "municipality"], ["Princeton", "municipality"], ["Mercer County", "county"], ["Cape May County", "county"]] as const;

export function DecisionGuide({
  artifactUrl,
  rate,
  newest,
}: {
  artifactUrl: string;
  rate: { value: number; asOf: string };
  newest: Record<string, string | null>;
}) {
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [placeId, setPlaceId] = useState<number | null>(null);
  const [load, setLoad] = useState<Load>({ state: "idle" });
  const [personal, setPersonal] = useState<Personal>({});
  const [income, setIncome] = useState("");
  const [size, setSize] = useState(3);
  const [rent, setRent] = useState("");
  const [home, setHome] = useState<GuideHome>({});
  const [cash, setCash] = useState<number | undefined>();

  // The place from the URL, and what this reader set on other pages.
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("place"));
    if (Number.isInteger(id) && id > 0) setPlaceId(id);
    setPersonal(readPersonal());
    const household = readHousehold();
    if (household.income) setIncome(String(household.income));
    if (household.size) setSize(household.size);
    setCash(household.cash);
    fetch("/search.json")
      .then((r) => (r.ok ? r.json() : null))
      // The guide reads one place's files; a state has none of its own here.
      .then((list: SearchEntry[] | null) => setEntries((list ?? []).filter((e) => e.level !== "state")))
      .catch(() => setEntries([]));
  }, []);

  useEffect(() => {
    if (placeId === null) return;
    let live = true;
    setLoad({ state: "loading" });
    const transfer = readGuideTransfer(placeId);
    setHome(transfer.home);
    setRent(transfer.rent === null ? "" : String(transfer.rent));
    loadPlace(artifactUrl, placeId, newest).then((data) => {
      if (live) setLoad(data ? { state: "ready", data } : { state: "failed" });
    });
    return () => {
      live = false;
    };
  }, [artifactUrl, placeId, newest]);

  const pick = (entry: SearchEntry) => {
    setPlaceId(entry.id);
    const url = new URL(window.location.href);
    url.searchParams.set("place", String(entry.id));
    window.history.replaceState(null, "", url);
  };
  const remember = (change: Personal) => {
    const next = { ...personal, ...change };
    setPersonal(next);
    writePersonal(next);
  };

  const examples = (entries ?? []).filter((entry) => GUIDE_EXAMPLES.some(([name, level]) => entry.name === name && entry.level === level));
  const ratePct = personal.ratePct ?? rate.value;
  const downPct = personal.downPct ?? 20;
  const years = Math.max(1, Math.min(30, Math.round(personal.years ?? 10)));
  const yearly = parseAmount(income);
  const data = load.state === "ready" ? load.data : null;
  const placeHref = data ? regionPath(data.region.region_id) : "/";
  const taxHref = data?.region.level === "municipality" ? `/tax?town=${data.region.geoid}` : "/tax";
  const afford = data && yearly ? affordAnswer(data, { income: yearly, size, ratePct, personal: { ...personal, downPct }, home }) : null;
  const choice = data ? rentOrBuy(data, { ratePct, personal: { ...personal, downPct, years }, home, rent: parseAmount(rent) }) : null;
  // A deep link to an answer or a check (`#guide-check-flood`) lands once the place loads.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!data || !hash) return;
    const target = document.getElementById(hash);
    if (target?.querySelector("details")) (target.querySelector("details") as HTMLDetailsElement).open = true;
    requestAnimationFrame(() => target?.scrollIntoView({ block: "start" }));
  }, [data]);

  return (
    <div className="decision-guide guide-steps-layout" data-ready={Boolean(data)} data-has-income={Boolean(yearly)}>
      <div className="wca-step-label wca-step-first"><span>1</span>Pick a place{!data && <em>Start here</em>}</div>
      <section className="guide-place guide-first" aria-labelledby="guide-place-heading">
        <h2 id="guide-place-heading" className={data ? undefined : "visually-hidden"}>{data ? data.region.label : "Choose a place"}</h2>
        <PlacePicker
          entries={entries}
          onPick={pick}
          label="A New Jersey county, town or ZIP code"
          placeholder="Search a county, town or ZIP code"
          name="guide-place"
          className="guide-picker"
          keepPicked
        />
        {!data && load.state === "idle" && examples.length > 0 && <div className="guide-examples">
          <span>Or try</span>
          {examples.map((entry) => <button key={entry.id} type="button" onClick={() => pick(entry)}>{entry.name}</button>)}
        </div>}
        {load.state === "loading" && <p className="meta">Loading this place’s figures…</p>}
        {load.state === "failed" && <p className="meta">This place’s figures could not be loaded. Try again, or choose another place.</p>}
        {data && <Link className="guide-place-link" href={placeHref}>{data.region.name}’s full page <span aria-hidden="true">→</span></Link>}
      </section>

      <div className="wca-step-label"><span>2</span>Your household</div>
      <section className="guide-household" aria-labelledby="guide-household-heading">
        <h2 id="guide-household-heading" className="visually-hidden">Your household</h2>
        <div className="guide-fields guide-fields-main">
          <label>
            Household income a year, before tax
            <input
              inputMode="numeric"
              value={income}
              placeholder="e.g. 95,000"
              onChange={(e) => {
                setIncome(e.target.value);
                const value = parseAmount(e.target.value);
                if (value) writeHousehold({ ...readHousehold(), income: value });
              }}
            />
          </label>
          <label>
            People in the household
            <select
              value={size}
              onChange={(e) => {
                setSize(Number(e.target.value));
                writeHousehold({ ...readHousehold(), size: Number(e.target.value) });
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label>
            Down payment
            <select value={downPct} onChange={(e) => remember({ downPct: Number(e.target.value) })}>
              {DOWN_PAYMENTS.map((d) => <option key={d} value={d}>{d}%{d === 3.5 ? " (FHA)" : ""}</option>)}
            </select>
          </label>
        </div>
        <details className="guide-assumptions"><summary>Adjust the rate, your cash, or use a listing’s figures</summary>
          <div className="guide-fields">
            <label>
              Mortgage rate, %
              <input
                inputMode="decimal"
                defaultValue={ratePct.toFixed(2)}
                key={ratePct}
                onBlur={(e) => {
                  const value = parseAmount(e.target.value);
                  if (value !== null && value > 0 && value < 20) remember({ ratePct: value });
                }}
              />
              <small className="src">Freddie Mac’s 30-year average, {rate.asOf}: {rate.value.toFixed(2)}%</small>
            </label>
            <label>Cash available for buying
              <input type="number" min="0" value={cash ?? ""} placeholder="Optional" onChange={e => {const value = parseAmount(e.target.value) ?? undefined; setCash(value); writeHousehold({...readHousehold(), cash:value});}} />
            </label>
          </div>
          <p className="meta">Home-specific figures stay with this place only. Personal assumptions are remembered in this browser. Neither changes published figures.</p>
          <div className="guide-fields">
            {([
              ["price", "Purchase price"], ["taxYear", "Property tax a year"], ["hoaMonth", "HOA or condo fees a month"],
              ["floodYear", "Flood insurance a year"], ["movingCost", "Moving costs"], ["repairsCost", "First repairs"],
            ] as const).map(([key,label]) => <label key={key}>{label}<input type="number" min={key === "price" ? 1 : 0} value={home[key] ?? ""} placeholder="Use published figure, where available" onChange={e => {const value=parseAmount(e.target.value); setHome(previous => {const next={...previous}; if(value===null || (key==="price" && value===0)) delete next[key]; else next[key]=value; return next;});}} /></label>)}
            {([
              ["insuranceYear", "Homeowners insurance a year"], ["pmiPct", "Mortgage insurance, % of loan a year"], ["upkeepPct", "Upkeep, % of price a year"],
              ["closingPct", "Closing costs, % of price"], ["rentGrowthPct", "Rents, % a year"], ["commissionPct", "Selling commission, %"],
            ] as const).map(([key,label]) => <label key={key}>{label}<input type="number" min="0" value={personal[key] ?? ""} placeholder="Default assumption" onChange={e => {const value=parseAmount(e.target.value); const next={...personal}; if(value===null) delete next[key]; else next[key]=value; setPersonal(next); writePersonal(next);}} /></label>)}
          </div>
        </details>
        <p className="guide-saved">Saved only in this browser, and shared with the site’s other cost tools.</p>
      </section>

      <div className="wca-step-label"><span>3</span>The answers</div>
      {!data ? <p className="wca-placeholder">Pick a place in step 1. Three answers show here: can you afford it, should you rent or buy, and what to check before an offer.</p> : <div className="guide-answers">

        <section className="guide-answer" aria-labelledby="guide-afford-heading">
          <div className="guide-answer-head">
            <h2 id="guide-afford-heading" tabIndex={-1}><small>01</small>Can I afford it?</h2>
            {afford && <Strength judged={afford.evidence} />}
          </div>
          {!yearly && <p className="guide-verdict-empty">Add your income in step 2 to see this answer.</p>}
          {yearly && !afford && <p>No usable home price is published here. Enter a listing price under “Adjust…” in step 2 to estimate buying costs.</p>}
          {afford && <>
            <p className="guide-verdict" data-band={afford.band}>{AFFORD_VERDICT[afford.band]}</p>
            <p className="guide-figure"><b>{usd(afford.month.total)}</b> a month to own · <b>{Math.round(afford.share * 100)}%</b> of your income</p>
            <p className="guide-sub">
              {afford.price.basis === "reader" ? "Your purchase price of" : afford.price.basis === "index" ? "The typical home here," : "The median sale here,"} {usd(afford.price.value)}, with {downPct}% down at {ratePct.toFixed(2)}%. Upfront cash: {usd(afford.upfront.low)}–{usd(afford.upfront.high)}.
            </p>
            <details className="guide-more"><summary>The cost breakdown and what it leaves out</summary>
              <dl className="cost-lines">
                {afford.month.lines.filter((line) => !line.conditional).map((line) => (
                  <div key={line.key} className={line.value === null ? "missing" : undefined}>
                    <dt>{line.label}</dt>
                    <dd>{line.value === null ? "not published here" : usd(line.value)}</dd>
                  </div>
                ))}
              </dl>
              <p className="guide-limit">{BAND_TEXT[afford.band]} Upfront cash is the down payment, closing costs and any moving or repair costs you entered. {cashFit(cash, afford.upfront.low, afford.upfront.high)}.</p>
              {afford.month.missing.length > 0 && <p className="guide-limit">A partial estimate: it leaves out {afford.month.missing.join(" and ").toLowerCase()}, which no source gives for this place.</p>}
              {afford.fha?.over && <p className="guide-limit">This loan is over FHA’s {afford.fha.year} limit for the county ({usd(afford.fha.limit)}), so FHA would not insure it.</p>}
              {afford.buyers && <p>Buyers here who borrowed to buy reported a median income of {afford.buyers.estimated ? "about " : ""}{usd(afford.buyers.income)} in {afford.buyers.year}.</p>}
              {afford.limits && <p>{afford.limits}</p>}
              <p className="guide-limit">HUD’s 30% and 50% lines are thresholds, not advice: lenders, savings and other debts all change what is right for you. Upkeep defaults to 1% of the price a year. Add HOA fees and flood insurance in step 2 if they apply.</p>
              {Object.keys(home).length > 0 && <p className="guide-limit">Your entered home figures are not independently verified. Evidence labels describe the published inputs only.</p>}
              <small className="src">
                Inputs: {[afford.price.basis === "reader" ? "purchase price: your input" : citation(data, data.levels.find((l) => l.metric_id === (afford.price.basis === "index" ? "zhvi_sfr" : "sr1a_median_sale_price")) ?? null),
                  home.taxYear !== undefined ? "tax: your input" : citation(data, data.levels.find((l) => l.metric_id === "modiv_median_tax_bill") ?? null),
                  personal.insuranceYear !== undefined ? "insurance: your input" : citation(data, data.levels.find((l) => l.metric_id === "acs_median_home_insurance") ?? null)].filter(Boolean).join("; ")}
              </small>
              <Steps steps={[
                { label: `Published figures for ${data.region.name}`, href: placeHref },
                { label: "Find a HUD-approved housing counselor", href: "https://www.consumerfinance.gov/find-a-housing-counselor/" },
              ]} />
            </details>
          </>}
          <details className="guide-more"><summary>Housing programme income limits & rents by home size</summary>
            <ForYourHousehold regionName={data.region.name} limits={data.incomeLimits} levels={data.levels} countyLevels={data.countyLevels} margins={new Map(data.levels.map(level => [level.metric_id, level.margin_of_error ?? null]))} />
          </details>
        </section>

        <section className="guide-answer" aria-labelledby="guide-rent-heading">
          <div className="guide-answer-head">
            <h2 id="guide-rent-heading" tabIndex={-1}><small>02</small>Rent or buy?</h2>
            {choice && <Strength judged={choice.evidence} />}
          </div>
          {!choice && <p>No home price or typical rent is published for this place. Enter the rent you would pay below to compare.</p>}
          {choice && <>
            <p className="guide-verdict" data-band="neutral">
              {choice.breakEven === null ? "Renting costs less" : choice.breakEven <= years ? `Buying wins from year ${choice.breakEven}` : `Buying only wins after year ${choice.breakEven}`}
            </p>
            <p className="guide-figure">Over <b>{years} years</b>: owning <b>{usd(choice.planned.net)}</b> · renting <b>{usd(choice.planned.rent ?? 0)}</b></p>
            <p className="guide-sub">Against {choice.ownRent ? "your rent" : "the typical rent here"} of {usd(choice.rent)} a month{choice.breakEven === null ? `, owning doesn’t cost less within ${MAX_YEARS} years` : ""}. Owning counts what the sale gives back.</p>
          </>}
          <details className="guide-more" open={!choice || undefined}><summary>Change the rent, years or price growth</summary>
            <div className="guide-fields">
              <label>
                Rent you would pay, a month
                <input inputMode="numeric" value={rent} placeholder="the typical rent here" onChange={(e) => setRent(e.target.value)} />
              </label>
              <label>
                Years you expect to stay
                <select value={years} onChange={(e) => remember({ years: Number(e.target.value) })}>
                  {Array.from({length:30},(_,i)=>i+1).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label>
                Home prices, % a year
                <input
                  inputMode="decimal"
                  defaultValue={String(personal.appreciationPct ?? 0)}
                  key={personal.appreciationPct ?? 0}
                  onBlur={(e) => {
                    const value = Number(e.target.value.replace("%", ""));
                    if (Number.isFinite(value) && Math.abs(value) <= 15) remember({ appreciationPct: value });
                  }}
                />
              </label>
            </div>
          </details>
          {choice && <details className="guide-more"><summary>See the two paths year by year</summary>
            <TwoPaths input={choice.inputs} onYears={n=>remember({years:n})} onPrice={n=>setHome(previous=>({...previous,price:n}))} onDown={n=>remember({downPct:n})} onRate={n=>remember({ratePct:n})} onUpkeep={n=>remember({upkeepPct:n})} onFlat={()=>remember({appreciationPct:0,rentGrowthPct:0})} />
            <p className="guide-limit">
              Assumptions: {choice.ownRent ? "your rent" : "the typical rent here"}, rising {personal.rentGrowthPct ?? 0}% a year;
              home prices {personal.appreciationPct ? `${personal.appreciationPct}% a year` : "flat"}; closing costs in the middle of
              {personal.closingPct !== undefined ? " your entered percentage" : " the CFPB’s range"}; a {personal.commissionPct ?? 5}% commission and New Jersey’s seller fees on sale; utilities left
              out, since renters and owners both pay them. Not a forecast: a sum over stated assumptions. What the down payment
              could earn instead is not counted.
            </p>
          </details>}
        </section>

        <section className="guide-answer guide-answer-checks" aria-labelledby="guide-checks-heading">
          <div className="guide-answer-head">
            <h2 id="guide-checks-heading" tabIndex={-1}><small>03</small>Before an offer</h2>
          </div>
          <p className="guide-sub">Ten things to check on the actual home. Tap one for its links and sources — area figures can’t establish one home’s risk, school or service.</p>
          <ul className="guide-checks guide-tiles">{checklist(data, {place: placeHref, tax: taxHref}).map(item => <Check key={item.key} item={item} />)}</ul>
        </section>
      </div>}

      <p className="guide-fineprint">Your numbers set against published local figures, by fixed calculations with sources and limits — not AI-written advice. <Link className="guide-help-shortcut" href="/help">Housing help ↗</Link></p>
    </div>
  );
}

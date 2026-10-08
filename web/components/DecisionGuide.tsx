"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
  MAX_YEARS,
  rentOrBuy,
} from "@/lib/guide";
import { readHousehold, writeHousehold } from "@/lib/household";
import type { IncomeLimits } from "@/lib/household";
import type { SearchEntry } from "@/lib/search";

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
        step.href.startsWith("/") ? (
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
    <li className="guide-check">
      <div className="guide-check-head">
        <h3>{item.title}</h3>
        <Strength judged={item.evidence} />
      </div>
      <p>{item.finding}</p>
      <p className="guide-limit">{item.limitation}</p>
      {item.source && <small className="src">Source: {item.source}</small>}
      <Steps steps={item.steps} />
    </li>
  );
}

const usd = (value: number) => formatValue(value, "usd");

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

  // The place from the URL, and what this reader set on other pages.
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("place"));
    if (Number.isInteger(id) && id > 0) setPlaceId(id);
    setPersonal(readPersonal());
    const household = readHousehold();
    if (household.income) setIncome(String(household.income));
    if (household.size) setSize(household.size);
    fetch("/search.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((list: SearchEntry[] | null) => setEntries(list ?? []))
      .catch(() => setEntries([]));
  }, []);

  useEffect(() => {
    if (placeId === null) return;
    let live = true;
    setLoad({ state: "loading" });
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

  const ratePct = personal.ratePct ?? rate.value;
  const downPct = personal.downPct ?? 20;
  const years = personal.years ?? 10;
  const yearly = parseAmount(income);
  const data = load.state === "ready" ? load.data : null;
  const placeHref = data ? `/regions/${data.region.region_id}` : "/";
  const taxHref = data?.region.level === "municipality" ? `/tax?town=${data.region.geoid}` : "/tax";
  const afford = data && yearly ? affordAnswer(data, { income: yearly, size, ratePct, personal: { ...personal, downPct } }) : null;
  const choice = data ? rentOrBuy(data, { ratePct, personal: { ...personal, downPct, years }, rent: parseAmount(rent) }) : null;

  return (
    <div className="decision-guide">
      <section className="section guide-place" aria-labelledby="guide-place-heading">
        <h2 id="guide-place-heading">{data ? data.region.label : "Choose a place"}</h2>
        <PlacePicker
          entries={entries}
          onPick={pick}
          label="A New Jersey county, town or ZIP code"
          placeholder="Search a county, town or ZIP code"
          name="guide-place"
          keepPicked
        />
        {load.state === "loading" && <p className="meta">Loading this place’s figures…</p>}
        {load.state === "failed" && <p className="meta">This place’s figures could not be loaded. Try again, or choose another place.</p>}
        {data && <p className="meta"><Link href={placeHref}>Everything published for {data.region.name}</Link></p>}
      </section>

      <section className="section guide-household" aria-labelledby="guide-household-heading">
        <h2 id="guide-household-heading">Your household</h2>
        <p className="meta">Kept in this browser only, and used on the site’s other cost pages.</p>
        <div className="guide-fields">
          <label>
            Yearly household income, before tax
            <input
              inputMode="numeric"
              value={income}
              placeholder="$95,000"
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
          <label>
            Mortgage rate, %
            <input
              inputMode="decimal"
              defaultValue={ratePct.toFixed(2)}
              key={ratePct === rate.value ? "published" : "own"}
              onBlur={(e) => {
                const value = parseAmount(e.target.value);
                if (value !== null && value > 0 && value < 20) remember({ ratePct: value });
              }}
            />
            <small className="src">Freddie Mac’s 30-year average, {rate.asOf}: {rate.value.toFixed(2)}%</small>
          </label>
        </div>
      </section>

      {data && (
        <>
          <section className="section guide-answer" aria-labelledby="guide-afford-heading">
            <div className="guide-check-head">
              <h2 id="guide-afford-heading">Can I afford to buy here?</h2>
              {afford && <Strength judged={afford.evidence} />}
            </div>
            {!yearly && <p className="meta">Enter your household income above.</p>}
            {yearly && !afford && <p>No home price is published for this place, so there is no cost of owning to set against your income.</p>}
            {afford && (
              <>
                <p className="guide-lead">
                  The {afford.price.basis === "index" ? "typical home here, valued at" : "median sale here,"}{" "}
                  <b>{usd(afford.price.value)}</b>, would cost about <b>{usd(afford.month.total)} a month</b> to own with{" "}
                  {downPct}% down at {ratePct.toFixed(2)}%: <b>{Math.round(afford.share * 100)}% of your income</b>.{" "}
                  {BAND_TEXT[afford.band]}
                </p>
                <dl className="cost-lines">
                  {afford.month.lines.filter((line) => !line.conditional).map((line) => (
                    <div key={line.key} className={line.value === null ? "missing" : undefined}>
                      <dt>{line.label}</dt>
                      <dd>{line.value === null ? "not published here" : usd(line.value)}</dd>
                    </div>
                  ))}
                </dl>
                {afford.month.missing.length > 0 && (
                  <p className="guide-limit">A partial estimate: it leaves out {afford.month.missing.join(" and ").toLowerCase()}, which no source gives for this place.</p>
                )}
                {afford.fha?.over && (
                  <p className="guide-limit">
                    This loan is over FHA’s {afford.fha.year} limit for the county ({usd(afford.fha.limit)}), so FHA would not insure it.
                  </p>
                )}
                {afford.buyers && (
                  <p>
                    Buyers here who borrowed to buy reported a median income of {afford.buyers.estimated ? "about " : ""}
                    {usd(afford.buyers.income)} in {afford.buyers.year}.
                  </p>
                )}
                {afford.limits && <p>{afford.limits}</p>}
                <p className="guide-limit">
                  HUD’s 30% and 50% lines are thresholds, not advice: lenders, savings and other debts all change what is right for you.
                  Upkeep is a rule of thumb, 1% of the price a year; HOA fees and flood insurance apply to some homes only and are left out.
                </p>
                <small className="src">
                  Sources: {[citation(data, data.levels.find((l) => l.metric_id === (afford.price.basis === "index" ? "zhvi_sfr" : "sr1a_median_sale_price")) ?? null),
                    citation(data, data.levels.find((l) => l.metric_id === "modiv_median_tax_bill") ?? null),
                    citation(data, data.levels.find((l) => l.metric_id === "acs_median_home_insurance") ?? null)].filter(Boolean).join("; ")}
                </small>
                <Steps steps={[
                  { label: `The full cost of owning in ${data.region.name}`, href: placeHref },
                  { label: "Find a HUD-approved housing counselor", href: "https://www.consumerfinance.gov/find-a-housing-counselor/" },
                ]} />
              </>
            )}
          </section>

          <section className="section guide-answer" aria-labelledby="guide-rent-heading">
            <div className="guide-check-head">
              <h2 id="guide-rent-heading">Should I rent or buy?</h2>
              {choice && <Strength judged={choice.evidence} />}
            </div>
            <div className="guide-fields">
              <label>
                Rent you would pay, a month
                <input inputMode="numeric" value={rent} placeholder="the typical rent here" onChange={(e) => setRent(e.target.value)} />
              </label>
              <label>
                Years you expect to stay
                <select value={years} onChange={(e) => remember({ years: Number(e.target.value) })}>
                  {[3, 5, 7, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label>
                Home prices, % a year
                <input
                  inputMode="decimal"
                  defaultValue={String(personal.appreciationPct ?? 0)}
                  onBlur={(e) => {
                    const value = Number(e.target.value.replace("%", ""));
                    if (Number.isFinite(value) && Math.abs(value) <= 15) remember({ appreciationPct: value });
                  }}
                />
              </label>
            </div>
            {!choice && <p>No home price or typical rent is published for this place. Enter the rent you would pay to compare.</p>}
            {choice && (
              <>
                <p className="guide-lead">
                  {choice.breakEven === null
                    ? <>Under these assumptions, owning does not cost less than renting at {usd(choice.rent)} a month within {MAX_YEARS} years.</>
                    : <>Under these assumptions, owning costs less than renting at {usd(choice.rent)} a month <b>from year {choice.breakEven}</b>.</>}
                </p>
                <p>
                  Over {years} years, owning and then selling costs about <b>{usd(choice.planned.net)}</b> after what the sale gives back;
                  renting costs about <b>{usd(choice.planned.rent ?? 0)}</b>.
                </p>
                <p className="guide-limit">
                  Assumptions: {choice.ownRent ? "your rent" : "the typical rent here"}, rising {personal.rentGrowthPct ?? 0}% a year;
                  home prices {personal.appreciationPct ? `${personal.appreciationPct}% a year` : "flat"}; closing costs in the middle of
                  the CFPB’s range; a {personal.commissionPct ?? 5}% commission and New Jersey’s seller fees on sale; utilities left
                  out, since renters and owners both pay them. Not a forecast: a sum over stated assumptions. What the down payment
                  could earn instead is not counted.
                </p>
                <Steps steps={[{ label: `Change any assumption on ${data.region.name}’s cost of owning`, href: placeHref }]} />
              </>
            )}
          </section>

          <section className="section guide-answer" aria-labelledby="guide-checks-heading">
            <h2 id="guide-checks-heading">What should I check before an offer?</h2>
            <p className="meta">What the published figures say about {data.region.name}, and where to check the home itself.</p>
            <ul className="guide-checks">
              {checklist(data, { place: placeHref, tax: taxHref }).map((item) => <Check key={item.key} item={item} />)}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

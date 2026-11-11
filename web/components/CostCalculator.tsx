"use client";

/**
 * MOCK (2026-11-11): the Cost calculator (ARCHITECTURE #499). One place and the reader's
 * own numbers in; what that place would cost them out: the month against their budget,
 * the cash before the keys, FHA's limit, and renting against buying. The same cost model
 * the guide and the cost cards use (`affordAnswer`, `rentOrBuy`), and the same saved
 * household and assumptions as the map's budget card.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadPlace } from "@/components/DecisionGuide";
import { affordAnswer, rentOrBuy, BAND_TEXT, type GuideData } from "@/lib/guide";
import { DOWN_PAYMENTS, incomeFor } from "@/lib/cost";
import { parseAmount, readPersonal, writePersonal, type Personal } from "@/lib/costScenario";
import { readHousehold, writeHousehold, type Household } from "@/lib/household";
import { formatValue } from "@/lib/format";
import { regionPath } from "@/lib/placeRoutes";
import type { SearchEntry } from "@/lib/search";

const usd = (v: number) => formatValue(v, "usd");
const STAYS = [3, 5, 7, 10, 15];

export function CostCalculator({ artifactUrl, rate, newest }: { artifactUrl: string; rate: { value: number; asOf: string }; newest: Record<string, string | null> }) {
  const [entries, setEntries] = useState<SearchEntry[]>([]);
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [placeId, setPlaceId] = useState<number | null>(null);
  const [data, setData] = useState<GuideData | null>(null);
  const [loading, setLoading] = useState(false);
  const [household, setHousehold] = useState<Household>({});
  const [personal, setPersonal] = useState<Personal>({});
  const [price, setPrice] = useState("");
  const [rent, setRent] = useState("");
  const [more, setMore] = useState(false);

  useEffect(() => {
    setHousehold(readHousehold()); setPersonal(readPersonal());
    fetch("/search.json").then((r) => r.json()).then((l: SearchEntry[]) => setEntries(l.filter((e) => e.level === "municipality" || e.level === "county" || e.level === "zip"))).catch(() => {});
    const id = Number(new URLSearchParams(window.location.search).get("place"));
    if (id > 0) setPlaceId(id);
  }, []);
  useEffect(() => {
    if (placeId === null) return;
    setLoading(true);
    loadPlace(artifactUrl, placeId, newest).then((d) => { setData(d); setLoading(false); if (d) setText(d.region.name); });
    const url = new URL(window.location.href); url.searchParams.set("place", String(placeId)); window.history.replaceState(null, "", url);
  }, [artifactUrl, placeId, newest]);

  const saveHousehold = (next: Household) => { setHousehold(next); writeHousehold(next); };
  const savePersonal = (next: Personal) => { setPersonal(next); writePersonal(next); };
  const setP = (key: keyof Personal, value: string) => { const next = { ...personal }; const v = parseAmount(value); if (v === null) delete next[key]; else next[key] = v; savePersonal(next); };

  const q = text.trim().toLowerCase();
  const suggestions = useMemo(() => (!q || data?.region.name.toLowerCase() === q ? [] : entries.filter((e) => e.name.toLowerCase().startsWith(q)).slice(0, 6)), [q, entries, data]);

  const income = household.income ?? 0;
  const downPct = personal.downPct ?? 20;
  const ratePct = personal.ratePct ?? rate.value;
  const years = personal.years ?? 7;
  const home = parseAmount(price) ? { price: parseAmount(price)! } : {};
  const afford = data && income > 0 ? affordAnswer(data, { income, size: household.size ?? 2, ratePct, personal: { ...personal, downPct }, home, prefer: "transactions" }) : null;
  const choice = data ? rentOrBuy(data, { ratePct, personal: { ...personal, downPct, years }, home, rent: parseAmount(rent), prefer: "transactions" }) : null;
  const budget = income > 0 ? (income / 12) * 0.3 : null;
  const cash = household.cash;

  return <section className="cc">
    <div className="cc-search">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input aria-label="Town, county or ZIP code" value={text} placeholder="Which place? e.g. Princeton" autoComplete="off" onFocus={() => setFocused(true)} onBlur={() => window.setTimeout(() => setFocused(false), 150)} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && suggestions[0]) setPlaceId(suggestions[0].id); }} />
      {focused && suggestions.length > 0 && <ul className="cc-suggest">{suggestions.map((e) => <li key={e.id}><button type="button" onMouseDown={(ev) => ev.preventDefault()} onClick={() => { setPlaceId(e.id); setText(e.name); }}><b>{e.name}</b><small>{e.detail}</small></button></li>)}</ul>}
    </div>

    <div className="cc-grid">
      <form className="cc-form" onSubmit={(e) => e.preventDefault()} aria-label="Your numbers">
        <h2>Your numbers</h2>
        <label className="cc-big">Household income a year<span><i>$</i><input inputMode="numeric" value={household.income ?? ""} placeholder="e.g. 150,000" onChange={(e) => saveHousehold({ ...household, income: parseAmount(e.target.value) ?? undefined })} /></span></label>
        <div className="cc-row">
          <label>Down payment<select value={downPct} onChange={(e) => savePersonal({ ...personal, downPct: Number(e.target.value) })}>{DOWN_PAYMENTS.map((d) => <option key={d} value={d}>{d}%</option>)}</select></label>
          <label>Cash saved<span><i>$</i><input inputMode="numeric" value={household.cash ?? ""} placeholder="optional" onChange={(e) => saveHousehold({ ...household, cash: parseAmount(e.target.value) ?? undefined })} /></span></label>
        </div>
        <div className="cc-row">
          <label>A listing’s price<span><i>$</i><input inputMode="numeric" value={price} placeholder={afford ? usd(afford.price.value) : "typical home"} onChange={(e) => setPrice(e.target.value)} /></span></label>
          <label>Your rent now<span><i>$</i><input inputMode="numeric" value={rent} placeholder={choice ? usd(choice.rent) : "typical rent"} onChange={(e) => setRent(e.target.value)} /></span></label>
        </div>
        <label>How long you’d stay<select value={years} onChange={(e) => savePersonal({ ...personal, years: Number(e.target.value) })}>{STAYS.map((y) => <option key={y} value={y}>{y} years</option>)}</select></label>
        <button type="button" className="cc-more-toggle" aria-expanded={more} onClick={() => setMore(!more)}>{more ? "Fewer assumptions" : "Rate, insurance and upkeep"}</button>
        {more && <div className="cc-row cc-row-3">
          <label>Mortgage rate %<input inputMode="decimal" value={personal.ratePct ?? ""} placeholder={rate.value.toFixed(2)} onChange={(e) => setP("ratePct", e.target.value)} /></label>
          <label>Insurance a year<input inputMode="decimal" value={personal.insuranceYear ?? ""} placeholder="area figure" onChange={(e) => setP("insuranceYear", e.target.value)} /></label>
          <label>Upkeep % a year<input inputMode="decimal" value={personal.upkeepPct ?? ""} placeholder="1" onChange={(e) => setP("upkeepPct", e.target.value)} /></label>
        </div>}
        <p className="cc-fine">Saved in this browser, shared with the map’s budget. Rate {ratePct.toFixed(2)}%{personal.ratePct === undefined ? `, the national average (${rate.asOf})` : ", yours"}.</p>
      </form>

      <div className="cc-result" aria-live="polite">
        {!data ? <p className="cc-empty">{loading ? "Loading the place’s figures…" : "Pick a place to see what it would cost you."}</p> : <>
          <header><h2>{data.region.name}</h2><Link href={regionPath(data.region.region_id)}>Published figures →</Link></header>

          <section className="cc-card" data-band={afford?.band}>
            <h3>Each month</h3>
            {afford ? <>
              <p className="cc-num"><b>{usd(afford.month.total)}</b>{budget && <span>of your {usd(budget)} budget · {Math.round(afford.share * 100)}% of income</span>}</p>
              <div className="cc-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, afford.share / 0.5 * 100)}%` }} /><b style={{ left: "60%" }} /></div>
              <p className="cc-say">{BAND_TEXT[afford.band]}{afford.band !== "within" && <> Keeping it at 30% takes about {usd(Math.ceil(incomeFor(afford.month.total) / 1000) * 1000)} a year.</>}</p>
              <p className="cc-fine">For {afford.price.basis === "reader" ? `your price, ${usd(afford.price.value)}` : `${afford.price.basis === "transactions" ? "the median sale price" : "Zillow’s typical home value"}, ${usd(afford.price.value)}`}. Not loan approval; HOA fees and flood insurance not included.</p>
            </> : <p className="cc-empty">Enter your income.</p>}
          </section>

          <section className="cc-card">
            <h3>Before the keys</h3>
            {afford ? <>
              <p className="cc-num"><b>{usd(afford.upfront.low)}{afford.upfront.high > afford.upfront.low ? `–${usd(afford.upfront.high)}` : ""}</b><span>down payment and closing costs</span></p>
              {cash !== undefined && <p className="cc-say">{cash >= afford.upfront.high ? `Your ${usd(cash)} covers it.` : cash >= afford.upfront.low ? `Your ${usd(cash)} may just cover it.` : `Your ${usd(cash)} is about ${usd(afford.upfront.low - cash)} short.`}</p>}
              {afford.fha && <p className="cc-say">{afford.fha.over ? `An FHA loan of ${usd(afford.fha.base)} is over the county’s ${afford.fha.year} limit of ${usd(afford.fha.limit)}.` : `Within the county’s ${afford.fha.year} FHA limit of ${usd(afford.fha.limit)}.`}</p>}
            </> : <p className="cc-empty">Enter your income.</p>}
          </section>

          <section className="cc-card">
            <h3>Rent or buy</h3>
            {choice ? <>
              <p className="cc-num"><b>{choice.breakEven === null ? "30+ years" : `${choice.breakEven} year${choice.breakEven === 1 ? "" : "s"}`}</b><span>until buying costs less than renting at {usd(choice.rent)} a month</span></p>
              <p className="cc-say">{choice.planned.rent !== null && (choice.planned.net <= choice.planned.rent
                ? `Staying ${years} years, buying comes out about ${usd(choice.planned.rent - choice.planned.net)} ahead.`
                : `Staying ${years} years, renting comes out about ${usd(choice.planned.net - choice.planned.rent)} ahead.`)}</p>
              <p className="cc-fine">Owning’s cost is everything paid, less what selling returns; a scenario, not a forecast.</p>
            </> : <p className="cc-empty">No rent figure here: enter your rent.</p>}
          </section>
        </>}
      </div>
    </div>
  </section>;
}

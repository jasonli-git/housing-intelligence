"use client";

/**
 * (#496) the Budget explorer folded into the housing map as a filter.
 *
 * A budget fades the places out of reach and leaves the chosen measure's shading on the
 * rest, so cost narrows the choice instead of being the whole of it. Everything the
 * Budget explorer (`AffordExplorer`) did is carried here: income, buy or rent, the price
 * basis (#493), down payment, county scope, the saved assumptions shared with place pages,
 * the count and the "out of" line, what would change the answer, the closest places over
 * budget, the caveats and "How we estimate", and its address parameters.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Gloss } from "@/components/Gloss";
import { budgetFit, monthlyBudget, priceBy, reach, type BudgetFit, type Mode, type Place, type PriceBasis, type Reached } from "@/lib/afford";
import { affordScope } from "@/lib/affordScope";
import { DEFAULT_DOWN, DOWN_PAYMENTS, incomeFor } from "@/lib/cost";
import { FHA_DOWN, FHA_LIMITS, UPKEEP_PCT } from "@/lib/costRules";
import { parseAmount } from "@/lib/costScenario";
import { formatValue } from "@/lib/format";
import { readHousehold } from "@/lib/household";
import { useBudgetScenario } from "./useBudgetScenario";

export type AtlasBudgetData = {
  counties: Place[];
  towns: Place[];
  rate: { value: number; asOf: string };
  asOf: { home: string; rent: string; tax: string; sale?: string; insurance?: string; utilities?: string };
};

const money = (value: number) => formatValue(value, "usd");
const MAX_DOWN = DOWN_PAYMENTS[DOWN_PAYMENTS.length - 1];

export type AtlasBudget = ReturnType<typeof useAtlasBudget>;

/** The budget's state and its reading of every place at the map's level. */
export function useAtlasBudget(data: AtlasBudgetData | undefined, level: string, metric: string) {
  const [on, setOn] = useState(false);
  const [incomeText, setIncomeText] = useState("");
  const [mode, setMode] = useState<Mode>("own");
  // Recorded sale prices by default: 24 towns go unpriced, against 176 on Zillow’s estimate.
  const [basis, setBasis] = useState<PriceBasis>("sales");
  const [down, setDown] = useState<number>(DEFAULT_DOWN);
  const [countyId, setCountyId] = useState<number | null>(null);
  const [addressRead, setAddressRead] = useState(false);
  const { personal, household, savePersonal, saveHousehold } = useBudgetScenario();
  useEffect(() => { setDown(personal.downPct ?? DEFAULT_DOWN); }, [personal.downPct]);
  useEffect(() => { setIncomeText(household.income === undefined ? "" : String(household.income)); }, [household.income]);

  // The Budget explorer's address, read once: `budget=1` (or an income) opens the form;
  // `mode`/`for=rent`, `price=sales`, `county` and `place` as on `/afford`.
  useEffect(() => {
    if (!data) return;
    const params = new URLSearchParams(window.location.search);
    const income = params.get("income")?.replace(/[^0-9]/g, "");
    if (income && Number(income) > 0) {
      setIncomeText(income);
      saveHousehold({ ...readHousehold(), income: Number(income) });
    }
    if (params.get("budget") === "1" || income) setOn(true);
    setMode(params.get("mode") === "rent" || (!params.has("mode") && params.get("for") === "rent") ? "rent" : "own");
    setBasis(params.get("price") === "zillow" ? "zillow" : "sales");
    const downParam = Number(params.get("down"));
    if ((DOWN_PAYMENTS as readonly number[]).includes(downParam)) setDown(downParam);
    if (params.has("place") || params.has("county")) setCountyId(affordScope(params, [...data.counties, ...data.towns]).countyId);
    setAddressRead(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (!addressRead) return;
    const timer = window.setTimeout(() => {
      const url = new URL(window.location.href);
      const p = url.searchParams;
      for (const key of ["budget", "mode", "for", "price", "county", "income"]) if (key !== "income" || !on) p.delete(key);
      if (on) {
        p.set("budget", "1");
        if (mode === "rent") p.set("mode", "rent");
        if (mode === "own" && basis === "zillow") p.set("price", "zillow");
        if (countyId !== null) p.set("county", String(countyId));
        if (p.has("income")) { const value = parseAmount(incomeText); if (value) p.set("income", String(value)); else p.delete("income"); }
      }
      window.history.replaceState(window.history.state, "", url);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [addressRead, on, mode, basis, countyId, incomeText]);

  const income = parseAmount(incomeText) ?? 0;
  const ratePct = personal.ratePct ?? data?.rate.value ?? 0;
  const options = { mode, income, downPct: down, ratePct, personal };
  const line = income > 0 ? monthlyBudget(income) : 0;
  const atTowns = level === "municipality";
  const active = Boolean(data && on && income > 0 && (atTowns || level === "county"));

  const reading = useMemo(() => {
    if (!data || !active) return null;
    const pool = atTowns ? data.towns : data.counties;
    const scoped = atTowns && countyId !== null ? pool.filter((p) => p.parentId === countyId) : pool;
    const rows = reach(priceBy(scoped, basis), options);
    const byId = new Map<number, { row: Reached; fit: BudgetFit }>(rows.map((row) => [row.place.id, { row, fit: budgetFit(row, line) }]));
    const within = rows.filter((r) => r.within);
    const count = (opts: typeof options, b: PriceBasis = basis) => reach(priceBy(scoped, b), opts);
    return {
      byId,
      within: within.length,
      outOf: rows.length,
      unlisted: scoped.length - rows.length,
      nearMisses: rows.filter((r) => !r.within && r.missing.length === 0).slice(0, 4),
      otherModeFits: count({ ...options, mode: mode === "own" ? "rent" : "own" }).filter((r) => r.within).length,
      moreDownFits: mode === "own" && down < MAX_DOWN ? count({ ...options, downPct: MAX_DOWN }).filter((r) => r.within).length : null,
      otherBasisListed: mode === "own" ? count(options, basis === "zillow" ? "sales" : "zillow").length : 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, active, atTowns, countyId, basis, mode, income, down, ratePct, personal]);

  return {
    data, on, setOn, incomeText, mode, setMode, basis, setBasis, down, countyId, setCountyId,
    income, line, ratePct, reading, active, atTowns, metric, personal, household, savePersonal,
    setIncome(text: string) { setIncomeText(text); saveHousehold({ ...household, income: parseAmount(text) ?? undefined }); },
    setDownPct(pct: number) { setDown(pct); savePersonal({ ...personal, downPct: pct }); },
    /** The budget's settings for a shared link: income included, since the reader chose to share. */
    share(p: URLSearchParams) {
      for (const key of ["budget", "mode", "for", "price", "county", "income", "down"]) p.delete(key);
      if (!on) return;
      p.set("budget", "1");
      if (income > 0) p.set("income", String(income));
      if (mode === "rent") p.set("mode", "rent");
      else { if (basis === "zillow") p.set("price", "zillow"); if (down !== DEFAULT_DOWN) p.set("down", String(down)); }
      if (countyId !== null) p.set("county", String(countyId));
    },
    setCash(text: string) { saveHousehold({ ...household, cash: parseAmount(text) ?? undefined }); },
    fitOf: (id: number): BudgetFit | undefined => (reading ? reading.byId.get(id)?.fit ?? "none" : undefined),
    costOf: (id: number): number | null => reading?.byId.get(id)?.row.monthly ?? null,
  };
}

/** One place's cost against the budget, for the map's selection card. */
export function BudgetLine({ budget, id }: { budget: AtlasBudget; id: number }): ReactNode {
  if (!budget.reading) return null;
  const entry = budget.reading.byId.get(id);
  const verb = budget.mode === "own" ? "own" : "rent";
  if (!entry) return <span className="atlas-budget-line">No {budget.mode === "own" ? (budget.basis === "sales" ? "recorded sale price or tax bill" : "home value or tax bill") : "rent figure"} here to price it; that doesn’t make it unaffordable.</span>;
  const { row, fit } = entry;
  const gap = budget.line - row.monthly;
  return <span className="atlas-budget-line" data-fit={fit}>
    About <b>{money(row.monthly)} a month</b> to {verb} the typical home · {fit === "within" ? `${money(gap)} to spare` : fit === "none" ? `missing ${row.missing.join(", ")}` : `${money(-gap)} over; needs about ${money(Math.ceil(incomeFor(row.monthly) / 1000) * 1000)} a year`}
  </span>;
}

/** The form and its answer, in the map's controls panel: inputs, one number, a key. */
export function BudgetPanel({ budget, onShowTowns }: { budget: AtlasBudget; onShowTowns: () => void }) {
  const b = budget;
  if (!b.data) return null;
  const { asOf, counties } = b.data;
  const r = b.reading;
  const county = counties.find((c) => c.id === b.countyId);
  const plural = b.atTowns ? "towns" : "counties";
  const needs = (monthly: number) => money(Math.ceil(incomeFor(monthly) / 1000) * 1000);
  const tips = r ? [
    r.otherModeFits > r.within && { key: "mode", label: `${b.mode === "own" ? "Renting" : "Buying"}: ${r.otherModeFits}`, act: () => b.setMode(b.mode === "own" ? "rent" : "own") },
    r.moreDownFits !== null && r.moreDownFits > r.within && { key: "down", label: `${MAX_DOWN}% down: ${r.moreDownFits}`, act: () => b.setDownPct(MAX_DOWN) },
  ].filter((t): t is { key: string; label: string; act: () => void } => Boolean(t)) : [];
  return <fieldset className="atlas-budget">
    <legend>Exclude what’s out of reach</legend>
    <label className="atlas-budget-income"><span aria-hidden="true">$</span><input inputMode="numeric" autoComplete="off" value={b.incomeText} placeholder="Income a year" aria-label="Household income a year, before tax" onChange={(e) => b.setIncome(e.target.value)} /><small aria-hidden="true">/ yr</small></label>
    <div className="atlas-budget-row">
      <div className="atlas-seg" role="radiogroup" aria-label="Buy or rent">{(["own", "rent"] as const).map((m) => <button type="button" role="radio" key={m} aria-checked={b.mode === m} onClick={() => b.setMode(m)}>{m === "own" ? "Buy" : "Rent"}</button>)}</div>
      {b.mode === "own" && <select className="atlas-budget-select" aria-label="Down payment" value={b.down} onChange={(e) => b.setDownPct(Number(e.target.value))}>{DOWN_PAYMENTS.map((d) => <option key={d} value={d}>{d}% down</option>)}</select>}
      {b.atTowns && <select className="atlas-budget-select" aria-label="Search in" value={b.countyId ?? "all"} onChange={(e) => b.setCountyId(e.target.value === "all" ? null : Number(e.target.value))}><option value="all">All NJ</option>{counties.map((c) => <option key={c.id} value={c.id}>{c.name.replace(/ County$/, "")}</option>)}</select>}
    </div>
    {b.mode === "own" && <div className="atlas-seg atlas-seg-small" role="radiogroup" aria-label="Price homes by" title="Which price the budget uses; the map's layer is separate.">{(["sales", "zillow"] as const).map((key) => <button type="button" role="radio" key={key} aria-checked={b.basis === key} onClick={() => b.setBasis(key)}>{key === "zillow" ? "Zillow estimate" : "Sale prices"}</button>)}</div>}

    {!b.atTowns && !b.active && b.income > 0 ? <p className="atlas-budget-hint">Budgets price towns and counties. <button type="button" className="atlas-inline-link" onClick={onShowTowns}>Show towns</button></p>
      : b.income <= 0 ? <p className="atlas-budget-hint">Enter an income to fade what’s out of reach.</p>
      : r && <div className="atlas-budget-answer" role="status">
        <p className="atlas-budget-count"><strong>{r.within}</strong> <span>{plural}{county ? ` in ${county.name.replace(/ County$/, "")}` : ""} within <b>{money(b.line)}</b>/mo</span></p>
        <ul className="atlas-budget-key" aria-label="Map key">
          <li data-fit="within">Within</li><li data-fit="near">≤15% over</li><li data-fit="over">Out of reach</li>{r.unlisted > 0 && <li data-fit="none" title="No price or tax figure to work out a monthly cost; not the same as out of reach">No figure · {r.unlisted}</li>}
        </ul>
        {tips.length > 0 && <div className="atlas-budget-tips" aria-label="More would fit with">{tips.map((t) => <button type="button" key={t.key} onClick={t.act}>{t.label}</button>)}</div>}
      </div>}

    {b.income > 0 && <details className="atlas-budget-more"><summary>Details & assumptions</summary>
      <dl className="atlas-budget-sum">
        <div><dt>Budget</dt><dd><b>{money(b.line)}</b>/mo <span>= 30% of {money(b.income)}</span></dd></div>
        {r && <div><dt>Fit</dt><dd><b>{r.within}</b> of {r.outOf} priced {plural}</dd></div>}
      </dl>

      {r && r.nearMisses.length > 0 && <section><h4>Closest over budget</h4>
        <table className="atlas-budget-near"><tbody>{r.nearMisses.map((row) => <tr key={row.place.id}><th scope="row">{row.place.name.replace(/ (township|borough|city|town|village)$/i, "")}</th><td>{money(row.monthly)}/mo</td><td>needs {needs(row.monthly)}</td></tr>)}</tbody></table>
      </section>}

      {b.mode === "own" && <section><h4>Your assumptions</h4><div className="atlas-budget-inputs">
        {([["ratePct", "Rate %", b.data.rate.value], ["upkeepPct", "Upkeep %/yr", UPKEEP_PCT], ["insuranceYear", "Insurance/yr", null]] as const).map(([key, label, fallback]) => <label key={key}>{label}<input inputMode="decimal" value={b.personal[key] ?? ""} placeholder={fallback === null ? "area" : String(fallback)} onChange={(e) => { const next = { ...b.personal }; const v = parseAmount(e.target.value); if (v === null) delete next[key]; else next[key] = v; b.savePersonal(next); }} /></label>)}
        <label>Cash<input inputMode="decimal" value={b.household.cash ?? ""} placeholder="optional" onChange={(e) => b.setCash(e.target.value)} /></label>
      </div></section>}

      <section><h4>What’s counted</h4>
        {b.mode === "own" ? <>
          <ul className="atlas-budget-chips">
            <li title={b.basis === "sales" ? `NJ deed records, ${asOf.sale ?? "latest"}` : `Zillow, ${asOf.home}`}>{b.basis === "sales" ? "Median sale price" : "Zillow home value"}</li>
            <li title={b.personal.ratePct === undefined ? `National average, ${b.data.rate.asOf}` : "Your rate"}>30-yr loan {b.ratePct.toFixed(2)}%</li>
            <li title={`NJ assessment records, ${asOf.tax}`}>Tax bill</li>
            <li>Insurance</li><li>Utilities</li><li>PMI if due</li><li>Upkeep {b.personal.upkeepPct ?? UPKEEP_PCT}%</li>
          </ul>
          <ul className="atlas-budget-chips" data-off><li>HOA fees</li><li>Flood insurance</li></ul>
        </> : <ul className="atlas-budget-chips"><li title={`Zillow, ${asOf.rent}`}>Asking rent</li></ul>}
      </section>

      <p className="atlas-budget-fine"><Gloss>{"Fits at 30% of income before tax (HUD's cost-burden line). Not loan approval."}</Gloss> Saved in this browser.{b.mode === "own" && b.down === FHA_DOWN && <> <a href={FHA_LIMITS.url} target="_blank" rel="noreferrer">FHA loan limits</a> not checked.</>}</p>
    </details>}
  </fieldset>;
}

/** The budget as its own card under the map's controls: a one-line summary that opens. */
export function BudgetCard({ budget, open, setOpen, controlsHeight, onEnable, onShowTowns }: { budget: AtlasBudget; open: boolean; setOpen: (open: boolean) => void; controlsHeight: number; onEnable: () => void; onShowTowns: () => void }) {
  const r = budget.reading;
  const plural = budget.atTowns ? "towns" : "counties";
  const summary = !budget.on ? "Set a budget" : r ? <><b>{r.within}</b> {plural} · {money(budget.line)}/mo</> : "Enter an income";
  return <section className="atlas-budget-card" aria-label="Exclude what’s out of reach" data-open={open} data-on={budget.on} style={{ ["--controls-h" as string]: `${controlsHeight ? controlsHeight + 10 : 0}px` }}>
    <header>
      <button type="button" className="atlas-budget-toggle" aria-expanded={open} onClick={() => { if (!budget.on) { budget.setOn(true); onEnable(); } setOpen(!open); }}>
        <span className="atlas-budget-title">Exclude what’s out of reach</span>
        <span className="atlas-budget-summary">{summary}</span>
        <span className="atlas-budget-chevron" aria-hidden="true">{open ? "–" : "+"}</span>
      </button>
      {budget.on && <button type="button" className="atlas-budget-remove" aria-label="Remove budget" title="Remove budget" onClick={() => { budget.setOn(false); setOpen(false); }}>×</button>}
    </header>
    {open && budget.on && <BudgetPanel budget={budget} onShowTowns={onShowTowns} />}
  </section>;
}

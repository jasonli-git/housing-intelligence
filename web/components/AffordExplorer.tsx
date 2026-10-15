"use client";

import { regionPath } from "@/lib/placeRoutes";
import Link from "next/link";
import { type KeyboardEvent, useEffect, useId, useMemo, useState } from "react";

import { PlacePicker } from "@/components/PlacePicker";
import {
  checkPlace,
  type Mode,
  monthlyBudget,
  type Place,
  type Reached,
  reach,
} from "@/lib/afford";
import { DEFAULT_DOWN, DOWN_PAYMENTS, incomeFor } from "@/lib/cost";
import { useBudgetScenario } from "./useBudgetScenario";
import { parseAmount } from "@/lib/costScenario";
import { cashFit } from "@/lib/budgetScenario";
import { readHousehold } from "@/lib/household";
import { FHA_DOWN, FHA_LIMITS, UPKEEP_PCT } from "@/lib/costRules";
import { formatValue } from "@/lib/format";
import type { SearchEntry } from "@/lib/search";
import { affordScope } from "@/lib/affordScope";

const DEFAULT_INCOME = "";
// The municipalities listed before "Show all": enough to answer, short enough to scan.
const FIRST_TOWNS = 25;


const MODES: { key: Mode; label: string }[] = [
  { key: "own", label: "Own" },
  { key: "rent", label: "Rent" },
];

function money(value: number): string {
  return formatValue(value, "usd");
}

function share(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function listed(items: string[]): string {
  return items.length <= 1
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** One side of "can I afford this place?": its monthly cost, its share of income, the verdict. */
function CheckCell({
  label,
  row,
  missing,
  cash,
}: {
  label: string;
  row: Reached | null;
  missing: string;
  cash?: number;
}) {
  if (!row) {
    return (
      <div className="check-cell">
        <span className="label">{label}</span>
        <p className="check-missing">{missing}</p>
      </div>
    );
  }
  return (
    <div className="check-cell">
      <span className="label">{label}</span>
      <b className="check-figure">
        {money(row.monthly)}
        <span>/mo</span>
      </b>
      <span className="check-share">
        {share(row.share)} of your income{" "}
        <span className={row.missing.length > 0 ? "status incomplete" : row.within ? "status within" : "status beyond"}>
          {row.missing.length > 0 ? "Incomplete estimate" : row.within ? "Within budget on included costs" : "Above budget on included costs"}
        </span>
      </span>
      {row.missing.length > 0 && <span className="check-need">Missing: {listed(row.missing)}. Not counted as within budget.</span>}
      {row.upfront && <span className="check-need">Buying upfront: {money(row.upfront.low)}–{money(row.upfront.high)}. {cashFit(cash, row.upfront.low, row.upfront.high)}.</span>}
      {row.upfront && <span className="check-need">Down payment + estimated closing costs. Moving, repairs and property-specific fees can add more.</span>}
      {!row.upfront && <span className="check-need">Rental deposits and move-in fees are not checked here.</span>}
      <span className="check-need">
        It takes {money(incomeFor(row.monthly))} a year to keep it at 30%.
      </span>
    </div>
  );
}

/**
 * The affordability page's controls and answers: an income, owning or renting, a down
 * payment, and every county and municipality marked within reach or not (Milestone 17).
 * All of it is computed in the browser from figures the page carries.
 *
 * Since Milestone 23 it also answers for one place — "can I afford this place?", a place
 * and an income together — and reads `?income=` and `?place=` from its address when it
 * loads, so the New Jersey page's call to action and a region page can open it filled in.
 */
export function AffordExplorer({
  counties,
  towns,
  rate,
  asOf,
  appearance = "classic",
  scope: initialScope,
}: {
  counties: Place[];
  towns: Place[];
  rate: { value: number; asOf: string };
  asOf: { home: string; rent: string; tax: string; insurance?: string; utilities?: string };
  appearance?: "classic" | "atlas";
  scope?: { countyId: number; countyName: string };
}) {
  const [incomeText, setIncomeText] = useState(DEFAULT_INCOME);
  const [mode, setMode] = useState<Mode>("own");
  const [down, setDown] = useState<number>(DEFAULT_DOWN);
  const { personal, household, savePersonal, saveHousehold } = useBudgetScenario();
  useEffect(() => { setDown(personal.downPct ?? DEFAULT_DOWN); }, [personal.downPct]);
  useEffect(() => { setIncomeText(household.income === undefined ? "" : String(household.income)); }, [household.income]);
  const [allTowns, setAllTowns] = useState(false);
  // A county profile has already answered "which place?". Start its local affordability
  // mode with that county selected instead of asking the reader to type it again.
  const [picked, setPicked] = useState<number | null>(initialScope?.countyId ?? null);
  const [countyId, setCountyId] = useState<number | null>(initialScope?.countyId ?? null);
  const selectedCounty = counties.find((place) => place.id === countyId);
  const scope = selectedCounty ? { countyId: selectedCounty.id, countyName: selectedCounty.name } : undefined;
  const id = useId();

  const places = useMemo(() => [...counties, ...towns], [counties, towns]);
  const entries: SearchEntry[] = useMemo(
    () =>
      places.map((p) => ({
        id: p.id,
        name: p.name,
        detail: p.detail ?? "County",
        level: p.level,
      })),
    [places],
  );

  // An income or a place passed in the address, read once on arrival. A static page has
  // no server to read it, and reading it here keeps the page renderable without it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const income = params.get("income")?.replace(/[^0-9]/g, "");
    if (income && Number(income) > 0) {
      setIncomeText(income);
      saveHousehold({ ...readHousehold(), income: Number(income) });
    }
    const context = affordScope(params, places);
    if (context.pickedId !== null) setPicked(context.pickedId);
    if (params.has("place") || params.has("county")) {
      setCountyId(context.countyId);
    }
  }, [places]);

  const income = Number(incomeText.replace(/[^0-9.]/g, "")) || 0;
  const options = { mode, income, downPct: down, ratePct: personal.ratePct ?? rate.value, personal };
  const countyRows = income > 0 ? reach(counties, options) : [];
  const allTownRows = income > 0 ? reach(towns, options) : [];
  const townRows = scope ? allTownRows.filter((row) => row.place.parentId === scope.countyId) : allTownRows;
  const townsWithin = townRows.filter((row) => row.within);
  const shownTowns = allTowns ? townsWithin : townsWithin.slice(0, FIRST_TOWNS);
  const pickedPlace =
    picked === null ? null : (places.find((p) => p.id === picked) ?? null);
  const check =
    pickedPlace && income > 0
      ? checkPlace(pickedPlace, options)
      : null;

  function onModeKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    event.preventDefault();
    const next = mode === "own" ? "rent" : "own";
    setMode(next);
    event.currentTarget
      .querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [next === "own" ? 0 : 1]?.focus();
  }

  // What would change the answer: the cheapest places just over budget, and how many
  // more places the other mode or the largest down payment would open up.
  const budget = income > 0 ? monthlyBudget(income) : 0;
  const nearMisses = townRows.filter((row) => !row.within && row.missing.length === 0).slice(0, 4);
  const scopedTowns = scope ? towns.filter((town) => town.parentId === scope.countyId) : towns;
  const otherMode: Mode = mode === "own" ? "rent" : "own";
  const otherModeFits = income > 0 ? reach(scopedTowns, { ...options, mode: otherMode }).filter((row) => row.within).length : 0;
  const maxDown = DOWN_PAYMENTS[DOWN_PAYMENTS.length - 1];
  const moreDownFits = income > 0 && mode === "own" && down < maxDown
    ? reach(scopedTowns, { ...options, downPct: maxDown }).filter((row) => row.within).length
    : null;
  const unlisted = scopedTowns.length - townRows.length;
  const stripRows = countyRows.filter((row) => row.missing.length === 0);
  const stripMax = Math.max(budget, ...stripRows.map((row) => row.monthly)) * 1.04;
  const verb = mode === "own" ? "buy" : "rent";
  // MOCKUP (2026-10-15): three places for "check a specific place", chosen by ?check=.
  const [checkLayout, setCheckLayout] = useState<"bottom" | "beside" | "toggle">("bottom");
  const [view, setView] = useState<"fit" | "check">("fit");
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("check");
    if (value === "beside" || value === "toggle") setCheckLayout(value);
  }, []);
  const picker = (
    <PlacePicker
      key={picked ?? "none"}
      className="place-search"
      entries={entries}
      onPick={(entry) => {
        setPicked(entry.id);
        const place = places.find((place) => place.id === entry.id);
        if (scope && place) setCountyId(place.level === "county" ? place.id : place.parentId ?? null);
      }}
      label="A town or county to check"
      placeholder="Type a town or county"
      name="check-place"
      initialQuery={pickedPlace?.name ?? ""}
      keepPicked
    />
  );
  const verdict = (row: Reached | null, what: string) => row === null
    ? <li><span>{what}</span><em>No figure</em></li>
    : <li data-fits={row.within}><span>{what}</span><b>{money(row.monthly)}<small>/mo</small></b>
        <em>{row.missing.length > 0 ? "Incomplete estimate" : row.within ? `Fits · ${money(budget - row.monthly)} to spare` : `Over by ${money(row.monthly - budget)}`}</em></li>;
  const quick = pickedPlace && check ? (
    <div className="wca-quick-result">
      <Link href={regionPath(pickedPlace.id)}>{pickedPlace.name}</Link>
      <ul>{verdict(check.own, "Buy")}{verdict(check.rent, "Rent")}</ul>
    </div>
  ) : <p className="wca-quick-empty">Type a town or county to see if its typical home fits {money(budget)} a month.</p>;

  return (
    <section className="afford budget-explorer wca" data-view="list" data-has-income={income > 0} aria-label="Find places within your budget">
      <div className="wca-step-label"><span>1</span>Your situation</div>
      <div className="afford-controls">
        <label className="control wca-income" htmlFor={`${id}-income`}>
          <span className="control-label">Household income a year, before tax</span>
          <span className="money-input">
            <span aria-hidden="true">$</span>
            <input
              id={`${id}-income`}
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 95,000"
              value={incomeText}
              onChange={(event) => {
                setIncomeText(event.target.value);
                saveHousehold({ ...household, income: parseAmount(event.target.value) ?? undefined });
              }}
            />
          </span>
        </label>
        <div className="control">
          <span className="control-label" id={`${id}-mode`}>
            Buy or rent
          </span>
          <div
            className="seg"
            role="radiogroup"
            aria-labelledby={`${id}-mode`}
            onKeyDown={onModeKeys}
          >
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={mode === m.key}
                tabIndex={mode === m.key ? 0 : -1}
                onClick={() => setMode(m.key)}
              >
                {m.key === "own" ? "Buy" : "Rent"}
              </button>
            ))}
          </div>
        </div>
        {mode === "own" && (
          <label className="control" htmlFor={`${id}-down`}>
            <span className="control-label">Down payment</span>
            <select
              id={`${id}-down`}
              value={down}
              onChange={(event) => { const downPct = Number(event.target.value); setDown(downPct); savePersonal({ ...personal, downPct }); }}
            >
              {DOWN_PAYMENTS.map((pct) => (
                <option key={pct} value={pct}>
                  {pct}%
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="control" htmlFor={`${id}-scope`}>
          <span className="control-label">Search in</span>
          <select id={`${id}-scope`} aria-label="Search in" value={countyId ?? "all"} onChange={(event) => {
            const next = event.target.value === "all" ? null : Number(event.target.value);
            setCountyId(next);
            setAllTowns(false);
            if (next !== null) setPicked(next);
            else setPicked(null);
          }}>
            <option value="all">All New Jersey</option>
            {counties.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
          </select>
        </label>
      </div>

      <div className="wca-step-label"><span>2</span>Your budget</div>
      <div className="budget-headline" aria-live="polite">
        {income > 0 ? <>
          <strong>{money(budget)}<small> a month</small></strong>
          <p>30% of {money(income)} a year — the usual line for what housing should cost.{mode === "own" && <> At a <b>{options.ratePct.toFixed(2)}%</b> mortgage rate with <b>{down}%</b> down.</>}</p>
        </> : <>
          <strong className="wca-empty">Enter your income</strong>
          <p>We’ll turn it into a monthly housing budget and show which towns’ typical homes fit it.</p>
        </>}
      </div>
      {income > 0 && <details className="budget-assumptions">
        <summary>Adjust the rate, insurance or upkeep</summary>
        <div className="budget-inputs">
          <label className="control">Cash available for buying<input inputMode="decimal" value={household.cash ?? ""} placeholder="optional" onChange={(event) => saveHousehold({ ...household, cash: parseAmount(event.target.value) ?? undefined })} /></label>
          {([ ["ratePct", "Mortgage rate, %", rate.value], ["insuranceYear", "Homeowners insurance a year", null], ["upkeepPct", "Upkeep, % of price a year", UPKEEP_PCT] ] as const).map(([key, label, fallback]) => <label className="control" key={key}>{label}<input inputMode="decimal" value={personal[key] ?? ""} placeholder={fallback === null ? "area figure" : String(fallback)} onChange={(event) => { const next = { ...personal }; const value = parseAmount(event.target.value); if (value === null) delete next[key]; else next[key] = value; savePersonal(next); }} /></label>)}
        </div>
        <p>Saved in this browser and shared with the cost cards on each place’s page.</p>
        {mode === "own" && down === FHA_DOWN && <p>FHA scenario: county loan limits are not checked. <a href={FHA_LIMITS.url} target="_blank" rel="noreferrer">Check the loan limit</a>.</p>}
      </details>}

      {income > 0 && <>
        <div className="wca-step-label"><span>3</span>Where it fits</div>
        {checkLayout === "toggle" && <div className="seg wca-view" role="radiogroup" aria-label="Show">
          <button type="button" role="radio" aria-checked={view === "fit"} onClick={() => setView("fit")}>Towns that fit</button>
          <button type="button" role="radio" aria-checked={view === "check"} onClick={() => setView("check")}>Check one place</button>
        </div>}
        {checkLayout === "toggle" && view === "check" ? <section className="wca-check-view">
          {picker}
          {quick}
        </section> : <>
        <div className="wca-answer" id={`${id}-summary`} aria-live="polite">
          <p className="wca-count"><b>{townsWithin.length}</b> {townsWithin.length === 1 ? "town" : "towns"}</p>
          <p className="wca-sentence">
            {townsWithin.length > 0
              ? <>where you could {verb} the typical home on {money(budget)} a month{scope ? <> in {scope.countyName}</> : null}, out of {townRows.length} with figures.</>
              : <>fit {money(budget)} a month to {verb} the typical home{scope ? <> in {scope.countyName}</> : null}. Here’s what comes closest.</>}
          </p>
          {(otherModeFits > townsWithin.length || (moreDownFits ?? 0) > townsWithin.length) && <p className="wca-tip">
            {otherModeFits > townsWithin.length && <button type="button" onClick={() => setMode(otherMode)}>{mode === "own" ? "Renting" : "Buying"}: {otherModeFits} {otherModeFits === 1 ? "town fits" : "towns fit"}</button>}
            {moreDownFits !== null && moreDownFits > townsWithin.length && <button type="button" onClick={() => { setDown(maxDown); savePersonal({ ...personal, downPct: maxDown }); }}>With {maxDown}% down: {moreDownFits} {moreDownFits === 1 ? "town fits" : "towns fit"}</button>}
          </p>}
        </div>

        <div className="wca-results" data-check={checkLayout}>
          {townsWithin.length > 0 && <section className="budget-town-results wca-list" aria-labelledby={`${id}-towns`}>
            <h2 id={`${id}-towns`}>Within your budget</h2>
            <ol>
              {shownTowns.map((row) => (
                <li key={row.place.id}>
                  <Link href={regionPath(row.place.id)}>{row.place.name}</Link>
                  {row.place.detail && <span className="wca-detail">{row.place.detail}</span>}
                  <span className="wca-cost">{money(row.monthly)}<small>/mo</small></span>
                  <span className="wca-room">{money(budget - row.monthly)} to spare</span>
                </li>
              ))}
            </ol>
            {townsWithin.length > FIRST_TOWNS && (
              <button type="button" className="button" onClick={() => setAllTowns((all) => !all)}>
                {allTowns ? `Show the first ${FIRST_TOWNS}` : `Show all ${townsWithin.length}`}
              </button>
            )}
          </section>}
          {nearMisses.length > 0 && <section className="wca-list wca-near" aria-labelledby={`${id}-near`}>
            <h2 id={`${id}-near`}>Closest to your budget</h2>
            <ol>
              {nearMisses.map((row) => (
                <li key={row.place.id}>
                  <Link href={regionPath(row.place.id)}>{row.place.name}</Link>
                  {row.place.detail && <span className="wca-detail">{row.place.detail}</span>}
                  <span className="wca-cost">{money(row.monthly)}<small>/mo</small></span>
                  <span className="wca-room">needs about {money(Math.ceil(incomeFor(row.monthly) / 1000) * 1000)} a year</span>
                </li>
              ))}
            </ol>
          </section>}
          {checkLayout === "beside" && <section className="wca-list wca-quick" aria-label="Check a specific place">
            <h2>Check a specific place</h2>
            {picker}
            {quick}
          </section>}
        </div>

        {!scope && stripRows.length > 0 && <section className="budget-comparison wca-strip" aria-labelledby={`${id}-strip`}>
          <h2 id={`${id}-strip`}>Counties, typical home to {verb}</h2>
          <p className="wca-strip-key"><span className="wca-key-line" aria-hidden="true" /> your budget, {money(budget)} · pick a county to search it</p>
          <ul style={{ ["--budget-at" as string]: `${(budget / stripMax) * 100}%` }}>
            {stripRows.map((row) => (
              <li key={row.place.id} data-within={row.within}>
                <button type="button" onClick={() => { setCountyId(row.place.id); setPicked(row.place.id); setAllTowns(false); }}>
                  <span className="wca-strip-name">{row.place.name.replace(/ County$/, "")}</span>
                  <span className="wca-strip-track"><span className="wca-strip-bar" style={{ width: `${(row.monthly / stripMax) * 100}%` }} /></span>
                  <span className="wca-strip-value">{money(row.monthly)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>}
        {scope && <p className="budget-scope-line wca-scope">Searching <b>{scope.countyName}</b> <button type="button" onClick={() => { setCountyId(null); setAllTowns(false); }}>Search all New Jersey</button></p>}

        <p className="wca-fineprint">
          Typical costs from published figures, not listings or loan approval{mode === "own" ? " — HOA fees and flood insurance aren’t included" : " — rent only, no utilities"}.
          {unlisted > 0 && <> {unlisted} towns without {mode === "own" ? "a home value or tax bill" : "a rent figure"} aren’t listed; that doesn’t make them unaffordable.</>}
        </p>
        </>}
      </>}

      {(checkLayout === "bottom" || income <= 0) && <details className="budget-place-check" open={pickedPlace && income > 0 ? true : undefined}>
      <summary>Check a specific town or county{pickedPlace ? ` · ${pickedPlace.name}` : ""}</summary>
      <section className="check" aria-labelledby={`${id}-check`}>
        <div className="check-head">
          <h2 id={`${id}-check`} className="check-title">
            Can I afford a specific place?
          </h2>
          {picker}
        </div>
        {pickedPlace && check ? (
          <>
            <p className="check-place">
              <Link href={regionPath(pickedPlace.id)}>
                {pickedPlace.name}
              </Link>
              {pickedPlace.detail && <span>{pickedPlace.detail}</span>}
            </p>
            <div className="check-grid">
              <CheckCell
                label="To own the typical single-family home"
                row={check.own}
                cash={household.cash}
                missing={
                  pickedPlace.home === null
                    ? "No Zillow home value for this comparison. Check the profile for any separately labelled sale-price scenario."
                    : "There is no property tax figure here, so the cost to own is not worked out."
                }
              />
              <CheckCell
                label="To rent the typical home · rent only"
                row={check.rent}
                missing="Zillow publishes no rent figure here."
              />
            </div>
          </>
        ) : (
          <p className="check-missing">
            {income > 0
              ? "Pick a town or county to see what its typical home costs at this income, owned and rented."
              : "Enter an income above, then pick a place."}
          </p>
        )}
      </section>
      </details>}

      <nav className="wca-mock-switch" aria-label="Mockup layouts">Mockup · check a place:
        {(["bottom", "beside", "toggle"] as const).map((layout) => <button key={layout} type="button" aria-pressed={checkLayout === layout} onClick={() => { setCheckLayout(layout); setView("fit"); }}>{layout === "bottom" ? "At the bottom" : layout === "beside" ? "Beside results" : "Toggle"}</button>)}
      </nav>

      <details className="afford-notes"><summary>How we estimate</summary><p className="table-note">
        {mode === "own" ? (
          <>
            Owning: Zillow’s typical single-family home value ({asOf.home}), a
            30-year fixed loan at {options.ratePct.toFixed(2)}% ({personal.ratePct === undefined ? `national average, ${rate.asOf}` : "your quoted rate"}) with {down}% down, and the typical property
            tax bill from New Jersey’s assessment records ({asOf.tax}).
            Included: homeowners insurance ({personal.insuranceYear === undefined ? `Census, ${asOf.insurance ?? "area figure"}` : "your annual quote"}) and utilities (electricity vintage {asOf.utilities ?? "area figure"}, gas and water where supplied), mortgage insurance when applicable, and upkeep ({personal.upkeepPct ?? UPKEEP_PCT}% of price a year, {personal.upkeepPct === undefined ? "a rule of thumb" : "your assumption"}), using the same calculation and saved assumptions as the profile cost cards. Missing required costs mean an incomplete estimate, never a fit. Places without a Zillow value or a
            matched tax bill are not counted.
          </>
        ) : (
          <>
            Renting: Zillow’s observed rent ({asOf.rent}), which covers every
            kind of rental home and is published for fewer places than home
            values. Places without it are not counted.
          </>
        )}{" "}
        A place fits when its typical monthly cost is at most 30% of income before tax, HUD’s cost-burden line.
        Computed from these figures by fixed rules; not a quote, and not written by AI.
      </p></details>
    </section>
  );
}

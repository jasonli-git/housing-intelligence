"use client";

import Link from "next/link";
import { Fragment, type KeyboardEvent, useEffect, useId, useMemo, useState } from "react";

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
import { type Focus, GlobeMap } from "@/components/GlobeMap";
import { useMapFile } from "@/components/useMapFile";
import type { SearchEntry } from "@/lib/search";
import { affordScope } from "@/lib/affordScope";

const DEFAULT_INCOME = "";
// The municipalities listed before "Show all": enough to answer, short enough to scan.
const FIRST_TOWNS = 25;

// The box the map is drawn in, as the New Jersey page's is.
const MAP_WIDTH = 540;
const MAP_HEIGHT = 580;

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

/** The three states the map paints, and what each one means. */
const REACH_KEY: readonly [string, string][] = [
  ["var(--seq-550)", "within reach"],
  ["var(--tick)", "beyond reach"],
  ["var(--nodata)", "missing or incomplete estimate"],
];

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
  const [view, setView] = useState<"list" | "map">("list");
  // A county profile has already answered "which place?". Start its local affordability
  // mode with that county selected instead of asking the reader to type it again.
  const [picked, setPicked] = useState<number | null>(initialScope?.countyId ?? null);
  const [countyId, setCountyId] = useState<number | null>(initialScope?.countyId ?? null);
  const [frameTarget, setFrameTarget] = useState<number | null>(initialScope?.countyId ?? null);
  const selectedCounty = counties.find((place) => place.id === countyId);
  const scope = selectedCounty ? { countyId: selectedCounty.id, countyName: selectedCounty.name } : undefined;
  const id = useId();
  const { file, layers, failed } = useMapFile();
  const [centre, setCentre] = useState<Focus | null>(null);

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
      setFrameTarget(context.pickedId ?? context.countyId);
    }
  }, [places]);

  const income = Number(incomeText.replace(/[^0-9.]/g, "")) || 0;
  const options = { mode, income, downPct: down, ratePct: personal.ratePct ?? rate.value, personal };
  const countyRows = income > 0 ? reach(counties, options) : [];
  const allTownRows = income > 0 ? reach(towns, options) : [];
  const townRows = scope ? allTownRows.filter((row) => row.place.parentId === scope.countyId) : allTownRows;
  const townsWithin = townRows.filter((row) => row.within);
  const countiesWithin = countyRows.filter((row) => row.within).length;
  const shownTowns = allTowns ? townsWithin : townsWithin.slice(0, FIRST_TOWNS);
  const comparisonRows = scope ? townRows : countyRows;
  const home =
    mode === "own"
      ? "owning the typical single-family home"
      : "renting the typical home";
  const pickedPlace =
    picked === null ? null : (places.find((p) => p.id === picked) ?? null);
  // The map paints from the same rows the lists are built from, so the two can never
  // disagree about whether a place is within reach.
  const byPlace = useMemo(
    () =>
      new Map([...countyRows, ...townRows].map((row) => [row.place.id, row])),
    [countyRows, townRows],
  );
  const paintReach = (id: number | string) => {
    const row = byPlace.get(Number(id));
    if (!row) return null;
    return row.missing.length > 0 ? "var(--nodata)" : row.within ? "var(--seq-550)" : "var(--tick)";
  };
  const reachOf = (id: number) => {
    const row = byPlace.get(id);
    if (scope && !row && towns.some((town) => town.id === id && town.parentId !== scope.countyId)) return "outside your selected county";
    if (!row) return "no figure for this measure here";
    return `${money(row.monthly)}/mo, ${share(row.share)} of income — ${row.missing.length > 0 ? `incomplete: ${listed(row.missing)}` : row.within ? "within budget on included costs" : "above budget"}`;
  };
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

  return (
    <section className="afford budget-explorer" data-view={view} data-has-income={income > 0} aria-labelledby={`${id}-summary`}>
      <div className="afford-controls">
        <label className="control" htmlFor={`${id}-scope`}>
          <span className="control-label">Where</span>
          <select id={`${id}-scope`} aria-label="Where" value={countyId ?? "all"} onChange={(event) => {
            const next = event.target.value === "all" ? null : Number(event.target.value);
            setCountyId(next);
            setFrameTarget(next);
            setAllTowns(false);
            setCentre(null);
            if (next !== null) setPicked(next);
            else setPicked(null);
          }}>
            <option value="all">All New Jersey</option>
            {counties.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
          </select>
        </label>
        <label className="control" htmlFor={`${id}-income`}>
          <span className="control-label">
            Yearly household income · before tax
          </span>
          <span className="money-input">
            <span aria-hidden="true">$</span>
            <input
              id={`${id}-income`}
              inputMode="numeric"
              autoComplete="off"
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
            Looking to
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
                {m.label}
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
      </div>

      <div className="budget-scope-line">
        <span>Searching <b>{scope?.countyName ?? "all New Jersey"}</b></span>
        {scope && <button type="button" onClick={() => { setCountyId(null); setFrameTarget(null); setCentre(null); setAllTowns(false); }}>Search all New Jersey <span aria-hidden="true">↗</span></button>}
      </div>

      <div className="budget-headline" aria-live="polite">
        <span>Your monthly housing budget</span>
        <strong>{income > 0 ? money(monthlyBudget(income)) : "Start with your income"}</strong>
        <p>30% of income before tax. A comparison guide, not loan approval.</p>
      </div>

      <details className="budget-assumptions">
        <summary>Your assumptions · {options.ratePct.toFixed(2)}% mortgage rate{mode === "rent" ? " · Rent only" : ""}</summary>
        <div className="budget-inputs">
          <label className="control">Cash available for buying<input inputMode="decimal" value={household.cash ?? ""} placeholder="optional" onChange={(event) => saveHousehold({ ...household, cash: parseAmount(event.target.value) ?? undefined })} /></label>
          {([ ["ratePct", "Mortgage rate, %", rate.value], ["insuranceYear", "Homeowners insurance a year", null], ["upkeepPct", "Upkeep, % of price a year", UPKEEP_PCT] ] as const).map(([key, label, fallback]) => <label className="control" key={key}>{label}<input inputMode="decimal" value={personal[key] ?? ""} placeholder={fallback === null ? "area figure" : String(fallback)} onChange={(event) => { const next = { ...personal }; const value = parseAmount(event.target.value); if (value === null) delete next[key]; else next[key] = value; savePersonal(next); }} /></label>)}
        </div>
        <p>Saved in this browser and shared with the cost cards. Property-specific prices, tax bills, HOA fees and flood premiums stay on the home’s profile.</p>
        {mode === "own" && down === FHA_DOWN && <p>FHA scenario: county loan limits are not checked. <a href={FHA_LIMITS.url} target="_blank" rel="noreferrer">Check the loan limit</a>.</p>}
      </details>

      <details className="budget-place-check" open={pickedPlace ? true : undefined}>
      <summary>Check one place{pickedPlace ? ` · ${pickedPlace.name}` : ""}</summary>
      <section className="check" aria-labelledby={`${id}-check`}>
        <div className="check-head">
          <h2 id={`${id}-check`} className="check-title">
            Can I afford a specific place?
          </h2>
          <PlacePicker
            key={picked ?? "none"}
            className="place-search"
            entries={entries}
            onPick={(entry) => {
              setPicked(entry.id);
              setFrameTarget(entry.id);
              const place = places.find((place) => place.id === entry.id);
              if (scope && place) setCountyId(place.level === "county" ? place.id : place.parentId ?? null);
            }}
            label="A town or county to check"
            placeholder="Type a town or county"
            name="check-place"
            initialQuery={pickedPlace?.name ?? ""}
            keepPicked
          />
        </div>
        {pickedPlace && check ? (
          <>
            <p className="check-place">
              <Link href={`/regions/${pickedPlace.id}`}>
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
      </details>

      <p className="table-note">Monthly results use a 30% income comparison, not loan approval. {mode === "own" ? "Incomplete estimates are not counted as within budget. Buying cash is checked separately for your selected place; HOA fees and flood premiums may add more." : "Rent-only results exclude utilities and renters insurance."}</p>
      <p className="afford-summary" id={`${id}-summary`} aria-live="polite">
        {income > 0 ? (
          scope ? <>
            With this budget, {home} is
            within reach in <b>{townsWithin.length}</b> of {townRows.length} municipalities in {scope.countyName}.
          </> : <>
            With this budget, {home} is
            within reach in <b>{countiesWithin}</b> of {countyRows.length}{" "}
            counties and <b>{townsWithin.length}</b> of {townRows.length}{" "}
            municipalities.
          </>
        ) : (
          "Enter a yearly household income to see where the typical home is within reach."
        )}
      </p>

      <div className="budget-view-choice" role="group" aria-label="Show budget results as">
        <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
        <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>Map</button>
      </div>
      {income > 0 && <div className="explorer">
        <div className="map-panel">
          {/* The globe, at municipal level: this page is about places a reader could
              live, and 564 towns is the answer where 21 counties is a summary. Milestone
              17 drew it on the two-dimensional county map and left carrying it here to
              Milestone 16 (#144). Painted in three states rather than by quantile — a town
              a few dollars over the line must not share a color with one a few under. */}
          <GlobeMap
            controls="budget"
            key={countyId ?? "statewide"}
            appearance={appearance}
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
            file={file}
            layers={layers}
            failed={failed}
            pin="municipality"
            metric=""
            windowKey=""
            metricLabel="within reach"
            windowPhrase=""
            format={money}
            formatChange={money}
            paint={paintReach}
            describe={`Municipalities in ${scope?.countyName ?? "New Jersey"} where ${home} is within reach on this income. The results list carries the same figures.`}
            legend={
              <p className="globe-ramp">
                <b>On this income</b>
                {REACH_KEY.map(([color, label]) => (
                  <span key={label}>
                    <i className="swatch" style={{ background: color }} />
                    {label}
                  </span>
                ))}
                {scope && <span>Towns outside {scope.countyName} are background context.</span>}
              </p>
            }
            active={picked}
            // Searching a place moves the map to it: the question on this page is where
            // a reader could live, and answering "can I afford Montclair?" while leaving
            // the map over somewhere else makes them find it themselves.
            frameOn={frameTarget}
            mute={false}
            onView={(state) => setCentre(state.focus)}
          />
          {centre && (
            <p className="readout" aria-live="polite">
              <b>{centre.name}</b> · {reachOf(Number(centre.id))}
            </p>
          )}
        </div>
        <div className="scroll-x budget-comparison">
          <table className="ranks">
            <thead>
              <tr>
                <th scope="col">{scope ? "Municipality" : "County"}</th>
                <th scope="col" className="num">
                  A month
                </th>
                <th scope="col" className="num">
                  Of income
                </th>
                <th scope="col">
                  <span className="visually-hidden">Within reach</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {([true, false] as const).map((within) => {
                const group = comparisonRows.filter((row) => row.within === within);
                if (!group.length) return null;
                return (
                  <Fragment key={String(within)}>
                    <tr className="afford-group-row"><th colSpan={4} scope="rowgroup">{scope
                      ? within ? "Municipalities within reach" : "Other municipalities"
                      : within ? "Counties within reach" : "Other counties"}</th></tr>
                    {group.map((row) => (
                      <tr
                        key={row.place.id}
                        className={row.within ? "within" : !scope ? "afford-secondary" : undefined}
                      >
                        <td><Link href={`/regions/${row.place.id}`}>{row.place.name}</Link><span className="budget-row-status">{row.missing.length > 0 ? `Incomplete: ${listed(row.missing)}` : row.within ? "Within budget on included costs" : "Above budget"}</span></td>
                        <td className="num">{money(row.monthly)}</td>
                        <td className="num">{share(row.share)}</td>
                        <td className="reach-mark">{row.missing.length > 0 ? `Incomplete: ${listed(row.missing)}` : row.within ? "within budget*" : ""}</td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>}

      {income > 0 && !scope && (
        <section className="section budget-town-results" aria-labelledby={`${id}-towns`}>
          <h2 id={`${id}-towns`}>Municipalities within reach</h2>
          {townsWithin.length === 0 ? (
            <p className="meta">
              None of the {townRows.length} municipalities with figures is
              within reach at this income.
              {townRows[0] && townRows[0].missing.length === 0 &&
                ` The least expensive is ${townRows[0].place.name}, at ${money(townRows[0].monthly)} a month — ${share(townRows[0].share)} of it.`}
            </p>
          ) : (
            <>
              <div className="scroll-x">
                <table className="ranks towns">
                  <thead>
                    <tr>
                      <th scope="col">Municipality</th>
                      <th scope="col" className="num">
                        A month
                      </th>
                      <th scope="col" className="num">
                        Of income
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownTowns.map((row) => (
                      <tr key={row.place.id}>
                        <td>
                          <Link href={`/regions/${row.place.id}`}>
                            {row.place.name}
                          </Link>
                          {row.place.detail && (
                            <span className="result-detail">
                              {" "}
                              {row.place.detail}
                            </span>
                          )}
                        </td>
                        <td className="num">{money(row.monthly)}</td>
                        <td className="num">{share(row.share)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {townsWithin.length > FIRST_TOWNS && (
                <button
                  type="button"
                  className="button"
                  onClick={() => setAllTowns((all) => !all)}
                >
                  {allTowns
                    ? `Show the first ${FIRST_TOWNS}`
                    : `Show all ${townsWithin.length}`}
                </button>
              )}
            </>
          )}
        </section>
      )}

      <details className="afford-notes"><summary>How these estimates are worked out</summary><p className="table-note">
        {mode === "own" ? (
          <>
            Owning: Zillow’s typical single-family home value ({asOf.home}), a
            30-year fixed loan at {options.ratePct.toFixed(2)}% ({personal.ratePct === undefined ? `national average, ${rate.asOf}` : "your quoted rate"}) with {down}% down, and the typical property
            tax bill from New Jersey’s assessment records ({asOf.tax}).
            Included: homeowners insurance ({personal.insuranceYear === undefined ? `Census, ${asOf.insurance ?? "area figure"}` : "your annual quote"}) and utilities (electricity vintage {asOf.utilities ?? "area figure"}, gas and water where supplied), mortgage insurance when applicable, and upkeep ({personal.upkeepPct ?? UPKEEP_PCT}% of price a year, {personal.upkeepPct === undefined ? "a rule of thumb" : "your assumption"}), using the same calculation and saved assumptions as the profile cost cards. See each profile for component dates and definitions. Missing required costs mean an incomplete estimate, never a green result. HOA fees and flood insurance are not included; add them for a specific home on its profile. Places without a Zillow value or a
            matched tax bill are not counted.
          </>
        ) : (
          <>
            Renting: Zillow’s observed rent ({asOf.rent}), which covers every
            kind of rental home and is published for fewer places than home
            values. Places without it are not counted.
          </>
        )}{" "}
        Computed from these figures by fixed rules; not a quote, and not written
        by AI.
      </p></details>
    </section>
  );
}
